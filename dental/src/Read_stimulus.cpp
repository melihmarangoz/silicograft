// Modified by Melih Marangoz in 2026 for the CalculiX port and the dental socket model
// (changes marked [CCX] and [DENTAL]; see NOTICE).
// [CCX] Read_stimulus.cpp -- CalculiX .dat okuyucu (orijinal: Abaqus *EL PRINT EP, SP tablosu)
//
// Orijinal (main dali) davranisi korunur:
//   - eleman basina 4 integrasyon noktasi (C3D10) okunur, EP1 (en kucuk asal sekil degistirme) ve
//     HP = -(s1+s2+s3)/3 IP'ler uzerinden ortalanir
//   - siniflandirma esikleri ve sirasi birebir ayni (Claes-Heigele + rezorpsiyon bolgesi)
// Farklar:
//   - CalculiX *EL PRINT asal degerleri yazmaz; "S, E" tensorleri okunur. Asal sekil degistirmeler
//     simetrik tensorun ozdegerlerinden hesaplanir. CalculiX kayma bilesenlerini TENSOR olarak yazar
//     (exy = gamma_xy / 2; birim testle dogrulandi: araclar/birim_testler.sh).
//     tr(S) = s1+s2+s3 oldugu icin HP asal gerilme gerektirmez.
//   - satirlar eleman etiketiyle eslenir (sira kaymasi olmaz); dosya/tablo/eleman eksikse false doner
//     (orijinal: sonsuz dongu ya da sessizce varsayilan stimulus).
//   - bayat sonuc okumamak icin run.sh ccx'ten once eski .dat'i siler ve ccx basarisizsa hata doner.
// Isaret: varsayilan orijinal kod (HP < -0.15 -> kikirdak; HP basma-pozitif oldugundan fiilen CEKME).
//   -DCLAES_HEIGELE_BASMA_POZITIF ile Claes & Heigele (1999) yorumu: kikirdak hidrostatik BASMADA (HP > 0.15).
#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>
#include <cmath>
#include <array>
#include "header.h"

using namespace std;

// [DENTAL] element values of the last FE solution, for Write_mechanics()
static vector<float> last_HP, last_minE;

#ifndef STIMULUS_FILE
#define STIMULUS_FILE "socket.dat" // [DENTAL]
#endif

// simetrik 3x3 matrisin en kucuk ozdegeri (analitik, trigonometrik yontem)
static double min_eigen_sym(double a11, double a22, double a33, double a12, double a13, double a23)
{
	const double p1 = a12 * a12 + a13 * a13 + a23 * a23;
	if (p1 < 1e-30) return min(a11, min(a22, a33));
	const double q = (a11 + a22 + a33) / 3.0;
	const double b11 = a11 - q, b22 = a22 - q, b33 = a33 - q;
	const double p2 = b11 * b11 + b22 * b22 + b33 * b33 + 2.0 * p1;
	const double p = sqrt(p2 / 6.0);
	// det(B)/2 / p^3
	const double detB = b11 * (b22 * b33 - a23 * a23) - a12 * (a12 * b33 - a23 * a13) + a13 * (a12 * a23 - b22 * a13);
	double r = detB / (2.0 * p * p * p);
	r = max(-1.0, min(1.0, r));
	const double phi = acos(r) / 3.0;
	return q + 2.0 * p * cos(phi + 2.0 * M_PI / 3.0); // en kucuk
}

// "stresses (...)" ya da "strains (...)" tablosunu oku: eleman -> IP bazinda 6 bilesen
// [DENTAL] occurrence: 0 = the last table in the file, 1 = the one before it, ... (one table per load step)
static bool read_table(const vector<string>& lines, const string& title, vector<vector<array<double, 6>>>& out,
                       int occurrence = 0)
{
	long start = -1;
	int seen = 0;
	for (long i = (long)lines.size() - 1; i >= 0; --i) // son adimin tablosu
		if (lines[i].find(title) != string::npos && lines[i].find("for set") != string::npos) {
			if (seen++ == occurrence) { start = i; break; }
		}
	if (start < 0) return false;
	out.assign(NUMBER_ELEMS, {});
	for (size_t li = start + 1; li < lines.size(); ++li) {
		const string& s = lines[li];
		if (s.find('(') != string::npos) break; // sonraki tablo basligi
		istringstream ss(s);
		int elem, ip; array<double, 6> v;
		if (!(ss >> elem >> ip >> v[0] >> v[1] >> v[2] >> v[3] >> v[4] >> v[5])) continue; // bos satir
		const int idx = elem - FIRST_CALLUS_ELEMENT;
		if (idx < 0 || idx >= NUMBER_ELEMS) continue;
		out[idx].push_back(v);
	}
	return true;
}

bool Read_stimulus(char stimulus_read[NUMBER_ELEMS], int /*elements_read*/[NUMBER_ELEMS][NODES_PER_ELEM])
{
	ifstream infile(STIMULUS_FILE);
	if (!infile) {
		cerr << "HATA: " << STIMULUS_FILE << " acilamadi (CalculiX calisti mi?)." << endl;
		return false;
	}
	vector<string> lines;
	string line;
	while (getline(infile, line)) lines.push_back(line);

	// [DENTAL] one S/E table pair per load step (one step unless P.bc_file holds several)
	vector<vector<vector<array<double, 6>>>> Ss, Es;
	for (int occ = 0;; occ++) {
		vector<vector<array<double, 6>>> S, E;
		if (!read_table(lines, "stresses (elem", S, occ) || !read_table(lines, "strains (elem", E, occ)) break;
		Ss.push_back(std::move(S)); Es.push_back(std::move(E));
	}
	if (Ss.empty()) {
		cerr << "HATA: " << STIMULUS_FILE << " icinde *EL PRINT S, E tablolari yok." << endl;
		return false;
	}

	int missing = 0;
	last_HP.assign(NUMBER_ELEMS, 0.f); last_minE.assign(NUMBER_ELEMS, 0.f); // [DENTAL]
	for (int elem = 0; elem < NUMBER_ELEMS; elem++) {
		bool ok = true;
		for (size_t st = 0; st < Ss.size(); st++)
			if (Ss[st][elem].size() != (size_t)IPS_PER_ELEM || Es[st][elem].size() != (size_t)IPS_PER_ELEM) ok = false;
		if (!ok) { missing++; continue; }
		double min_E_read = 0, HP_read = 0, worst = -1;
		// [DENTAL] stimulus_mode 1: the cells sense the soft-tissue phase. Under the rule of mixtures (iso-strain,
		// Voigt) every phase of the element has the element strain, so the soft phase's hydrostatic pressure is
		// -K_soft tr(e), K_soft = E_soft / (3 (1 - 2 nu)) with nu = 0.167 for all soft tissues. For an element without
		// bone this equals the element value; with bone, the stiff matrix no longer sets the pressure.
		const double K_soft = E_soft_phase[elem] / (3.0 * (1.0 - 2.0 * 0.167));
		// [DENTAL] several load steps: the daily peak envelope, i.e. the step whose (HP, e_min) lies farthest outside
		// the bone window (|HP| / 0.15 MPa, |e_min| / 0.05) sets the stimulus; one step: as before
		for (size_t st = 0; st < Ss.size(); st++) {
			double mE = 0, hp = 0;
			for (int j = 0; j < IPS_PER_ELEM; j++) {
				const auto& e = Es[st][elem][j]; // exx eyy ezz exy exz eyz (tensor)
				const auto& s = Ss[st][elem][j];
				mE += min_eigen_sym(e[0], e[1], e[2], e[3], e[4], e[5]); // EP1
				if (P.stimulus_mode == 1) hp += -K_soft * (e[0] + e[1] + e[2]); // [DENTAL]
				else hp += -(s[0] + s[1] + s[2]) / 3;                            // -(SP1+SP2+SP3)/3
			}
			mE /= IPS_PER_ELEM; hp /= IPS_PER_ELEM;
			const double sev = max(fabs(hp) / 0.15, fabs(mE) / 0.05);
			if (sev > worst) { worst = sev; min_E_read = mE; HP_read = hp; }
		}
		last_HP[elem] = (float)HP_read; last_minE[elem] = (float)min_E_read; // [DENTAL]

		// Define stimulus (orijinal main Read_stimulus.cpp ile ayni)
		if (P.lower_window && fabs(HP_read) < 0.0016 && fabs(min_E_read) < 0.0004) { // [DENTAL] P.lower_window
			stimulus_read[elem] = 1; // resorption
		}
		else if (fabs(HP_read) < 0.15 && fabs(min_E_read) < 0.05) {
			stimulus_read[elem] = 2; // intramembranous (bone)
		}
#ifdef CLAES_HEIGELE_BASMA_POZITIF
		else if (HP_read > 0.15 && fabs(min_E_read) < 0.15) {
#else
		else if (HP_read < -0.15 && fabs(min_E_read) < 0.15) {
#endif
			stimulus_read[elem] = 4; // endochondral (cartilage)
		}
		else {
			stimulus_read[elem] = 5; // fibrocartilage or connective
		}
	}
	// [DENTAL] biology-only setting: every element gets the same stimulus whatever the mechanics
	// (force_stimulus 2: bone-permissive everywhere).
	if (P.force_stimulus > 0)
		for (int elem = 0; elem < NUMBER_ELEMS; elem++) stimulus_read[elem] = (char)P.force_stimulus;
	if (missing > 0) {
		cerr << "HATA: " << missing << "/" << NUMBER_ELEMS << " kallus elemani icin " << IPS_PER_ELEM << " IP verisi yok." << endl;
		return false;
	}
	return true;
}

// [DENTAL] Per-element hydrostatic pressure (MPa, compression positive) and minimum principal strain of the
// FE solution read last: mech_<iter>.bin holds NUMBER_ELEMS float32 HP values followed by NUMBER_ELEMS
// float32 strains. mechanics.csv gets one summary line per iteration.
#include <algorithm>
void Write_mechanics(int iter)
{
	if ((int)last_HP.size() != NUMBER_ELEMS) return;
	ofstream b("mech_" + to_string(iter) + ".bin", ios::binary);
	b.write(reinterpret_cast<const char*>(last_HP.data()), sizeof(float) * NUMBER_ELEMS);
	b.write(reinterpret_cast<const char*>(last_minE.data()), sizeof(float) * NUMBER_ELEMS);
	auto pct = [](vector<float> v, double q) { std::sort(v.begin(), v.end()); return v[(size_t)(q * (v.size() - 1))]; };
	vector<float> aHP(NUMBER_ELEMS), aE(NUMBER_ELEMS);
	for (int e = 0; e < NUMBER_ELEMS; e++) { aHP[e] = fabs(last_HP[e]); aE[e] = fabs(last_minE[e]); }
	const bool header = !ifstream("mechanics.csv").good();
	ofstream f("mechanics.csv", ios::app);
	if (header) f << "iteration,absHP_p10,absHP_p50,absHP_p90,absHP_max,absminE_p10,absminE_p50,absminE_p90,absminE_max\n";
	f << iter << "," << pct(aHP, .1) << "," << pct(aHP, .5) << "," << pct(aHP, .9) << "," << pct(aHP, 1.)
	  << "," << pct(aE, .1) << "," << pct(aE, .5) << "," << pct(aE, .9) << "," << pct(aE, 1.) << "\n";
}
