# Search task: longitudinal 3D imaging of bone healing around an immediate implant with β-TCP

## Background
I am running a 3D mechanobiological simulation of bone healing. The model couples an agent-based cell model with finite-element mechanics on a 0.1 mm voxel lattice and outputs the 3D distribution of tissue types (bone, cartilage, fibrous tissue, residual graft) every few days, for up to a year or longer.

The clinical scenario I simulate is an **immediate dental implant placed in a fresh extraction socket, with the gap between the implant and the socket walls filled with pure-phase β-tricalcium phosphate (β-TCP) granules**.

To validate the simulation I need **real 3D images of the same kind of case taken at several time points**, so I can place the simulated tissue distribution on a given day next to the image from that day and compare the two, both visually and with measurements.

## What I need, in order of priority
1. **Raw longitudinal 3D image data** of an immediate implant with β-TCP.
   - Formats: DICOM CT/CBCT, micro-CT slice stacks, or MRI volumes.
   - Must be downloadable from a repository or a supplement, or explicitly available from the authors on request.
2. **Papers on the same scenario** that show time-series 3D images (CT/CBCT/micro-CT/MRI slices or 3D renderings) together with quantitative measurements at each time point.
3. **Close scenarios** that meet the same imaging conditions, if they are well documented:
   - immediate implant in a socket with a different graft (BCP, xenograft, allograft) or no graft
   - β-TCP socket preservation without an implant
   - an implant placed later into a socket grafted with β-TCP
   - an animal peri-implant defect filled with β-TCP

## Conditions
- **Species:** human or animal, both are fine. Useful animals are dog, minipig, sheep and goat. Rabbit and rat are lower priority, but in vivo micro-CT series in them are still welcome.
- **Imaging:** CT, CBCT, micro-CT (in vivo or ex vivo) or MRI, with at least two time points. A baseline scan right after surgery is very valuable.
- **Duration:** the longer the better. 6 months or more is preferred, 12 months or more is ideal, and multi-year follow-up is excellent.
- **Same subjects over time:** series that rescan the same patient or animal are preferred over designs that sacrifice different animals at each time point. Report which design each study used.
- **Useful measurements at each time point:**
  - bone volume or BV/TV
  - mineralized tissue volume, and residual graft volume if it was separated from new bone
  - density (HU or gray values)
  - gap fill
  - buccal and lingual bone thickness at several levels
  - crestal bone height change
  - bone-implant contact measured on micro-CT

## Search strategy
- **Literature databases:**
  - PubMed, Europe PMC (including supplementary files), Google Scholar, Scopus or Web of Science, Semantic Scholar, OpenAlex.
  - Also scan the reference lists of systematic reviews on immediate implants, jumping-gap grafting and alveolar ridge preservation with β-TCP.
- **Data repositories:**
  - Zenodo, Figshare, Dryad, OSF, Mendeley Data, Harvard Dataverse, MorphoSource, The Cancer Imaging Archive, DataCite search.
  - Dental CBCT datasets on Kaggle or GitHub.
  - ClinicalTrials.gov entries with results or an individual-participant-data sharing statement.
- **Example search terms** (combine and vary):
  - "immediate implant" OR "immediate implant placement" OR "fresh extraction socket"
  - "beta-tricalcium phosphate" OR "β-TCP" OR "Cerasorb" OR "GEM 21S" OR "R.T.R."
  - "jumping gap" OR "peri-implant gap" OR "buccal gap"
  - "CBCT" OR "cone beam" OR "micro-CT" OR "computed tomography" OR "MRI"
  - "longitudinal" OR "follow-up" OR "12 months" OR "time course"
  - "bone volume" OR "buccal bone thickness" OR "bone density" OR "Hounsfield"
  - "dataset" OR "DICOM" OR "data availability"

## Report format
Rank the results by priority group (1, 2, 3), then by how long and complete the series is. For each item give:
- **Citation:** full citation, DOI or PMID, and a link.
- **Scenario:**
  - species and n
  - jaw and tooth site
  - implant brand and size
  - graft product and granule size
  - gap width
  - loading protocol (immediate or delayed)
- **Imaging:**
  - modality, device and voxel size
  - time points, and whether the same subjects were rescanned
  - how bone was separated from graft
  - whether metal artifact reduction was used
- **Measurements:** the numbers reported at each time point, with units and the table or figure they come from.
- **Images:** which figures show the time-series slices or 3D renderings.
- **Raw data:** link, format, size and license. If the data is "available on request", give the corresponding author's name. Do not contact anyone.
- **Access:** open access (PMC, publisher OA, institutional repository) or paywalled (the full text will be obtained through the university library).
- **Limitations:** anything that would make a comparison with the simulation hard.

End with:
- the top 5 candidates and why they are best
- the scenarios or data you looked for and did not find

## Rules
- Use only legitimate sources: open access, publishers, data repositories, trial registries.
- Verify every DOI and link. Do not invent papers, numbers or datasets. If something is uncertain, mark it as uncertain.
- Studies already known to me (still report them if you find imaging data or raw data for them):
  - Daif 2013, J Oral Implantol, doi:10.1563/AAID-JOI-D-11-00079 (CT density at 3 and 6 months after loading)
  - Elsheikh 2023, BMC Oral Health
  - Salem 2026, BMC Oral Health
  - Hong 2014, Clin Oral Implants Res, doi:10.1111/clr.12041
  - Xu 2016, Clin Implant Dent Relat Res, doi:10.1111/cid.12259
  - Boix 2004, J Periodontol, doi:10.1902/jop.2004.75.5.663
