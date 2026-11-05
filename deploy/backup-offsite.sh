#!/bin/sh
# Copie hors du serveur des sauvegardes quotidiennes (à lancer chaque nuit par cron).
# Exemple cron : 30 2 * * * /opt/ayoka-quinca/deploy/backup-offsite.sh
# Nécessite rclone configuré vers Google Drive (remote nommé "gdrive").
set -eu
VOL=$(docker volume inspect -f '{{ .Mountpoint }}' deploy_ayoka-data)
rclone copy "$VOL/backups" gdrive:ayoka-quinca/backups --max-age 48h
