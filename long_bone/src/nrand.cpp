// Modified by Melih Marangoz in 2026 for the CalculiX port (changes marked [CCX]; see NOTICE).
// [CCX] nrand.cpp (05_Mechanabio/duzeltilmis_kod surumu)
// Orijinal: rand() tabanlı; Windows/MinGW'de RAND_MAX = 32767 olduğundan n > 32767 için
// özyinelemeli dal devreye giriyor, n % RAND_MAX == 0 olduğunda nrand(0) -> domain_error fırlatıyor
// ve dağılım düzgün değil. Ayrıca random_shuffle (Cell_migration) rand()'ı ayrıca kullanıyordu.
// Yeni: tek bir std::mt19937 motoru + std::uniform_int_distribution (platformdan bağımsız, tekrarlanabilir).
#include <stdexcept>
#include "header.h"

std::mt19937& rng() {
	static std::mt19937 engine(12345u);
	return engine;
}

void seed_rng(unsigned int seed) { rng().seed(seed); }

int nrand(int n) {
	if (n <= 0) {
		throw std::domain_error("nrand: n > 0 olmali");
	}
	std::uniform_int_distribution<int> dist(0, n - 1);
	return dist(rng());
}
