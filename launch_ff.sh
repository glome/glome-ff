#!/bin/sh
touch install.rdf
/Applications/Firefox.app/Contents/MacOS/firefox-bin -no-remote -purgecaches -P dev2 &
