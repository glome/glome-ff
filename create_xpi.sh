#!/bin/bash
TIMESTAMP=`date +%Y_%m_%d_%H%M`

TEMPDIR=/tmp
VERSION=0.${TIMESTAMP}
XPI=glome_${VERSION}.xpi

sed -i.prev "s|<em:version>.*<\/em:version>|<em:version>${VERSION}<\/em:version>|" install.rdf
zip -r ${TEMPDIR}/${XPI} chrome/ components/ defaults/ chrome.manifest install.rdf version
