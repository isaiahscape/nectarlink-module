#!/system/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later

# Clear cached PackageParser results for Nectarlink APKs so Android always parses updated manifests and permissions.
rm -rf /data/system/package_cache/*/*Nectarlink* /data/system/package_cache/*Nectarlink* 2>/dev/null
