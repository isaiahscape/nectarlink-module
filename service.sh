#!/system/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later

MODDIR="${0%/*}"

until [ "$(getprop sys.boot_completed)" = "1" ]; do
  sleep 2
done

dumpsys deviceidle whitelist +app.nectarlink.services >/dev/null 2>&1

for PKG in app.nectarlink app.nectarlink.dev; do
  if pm path "$PKG" >/dev/null 2>&1; then
    dumpsys deviceidle whitelist +"$PKG" >/dev/null 2>&1
    appops set "$PKG" MANAGE_ONGOING_CALLS allow >/dev/null 2>&1
    appops set "$PKG" RECEIVE_SENSITIVE_NOTIFICATIONS allow >/dev/null 2>&1
    appops set "$PKG" GET_USAGE_STATS allow >/dev/null 2>&1
    appops set "$PKG" WRITE_SETTINGS allow >/dev/null 2>&1
    cmd notification allow_dnd "$PKG" >/dev/null 2>&1
  fi
done
