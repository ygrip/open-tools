# Social-card fonts

`nunito.ttf` (weight 400) and `nunito-bold.ttf` (weight 800) are static Latin instances of the project's `@fontsource-variable/nunito/files/nunito-latin-wght-normal.woff2`, generated with FontTools `instantiateVariableFont(..., {"wght": weight}, updateFontNames=True)` and saved without WOFF2 flavor. They retain the original SIL Open Font License in `OFL.txt`.

Resvg uses these explicit font files rather than operating-system fonts. Static instances ensure the requested bold weight renders correctly and keep social-card output consistent across local and CI builds. They are build inputs, not additional browser font downloads; the app still uses its single subsetted variable WOFF2.
