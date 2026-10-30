/* Greater — UI translations (en / fr / es / de / ar).
 * Loaded before app.js. Default language is English so tests and screenshots
 * stay deterministic; the choice is persisted in localStorage.
 * Placeholders use {name} and are substituted by t().
 */

const LANG_KEY = "greater.lang";
const LANGS = ["en", "fr", "es", "de", "ar"];

const I18N = {};

I18N.en = {
  "app.tagline": "disk usage analyzer",
  "app.sections": "Sections",
  "tab.explorer": "Explorer",
  "tab.clean": "Clean",
  "tab.dupes": "Duplicates",
  "tab.stats": "Statistics",
  "header.elevated": "elevated",

  "btn.help": "Help",
  "btn.help.title": "Help — what is this app?",
  "btn.settings": "Settings",
  "btn.settings.title": "Settings — appearance and language",
  "btn.scan": "Scan",
  "btn.cancel": "Cancel",
  "btn.close": "Close",
  "btn.about": "About",
  "about.title": "About Greater",
  "about.version": "Version 1.0",
  "about.developer": "Developer",
  "about.company": "Company",
  "about.email": "Contact",
  "about.desc": "A fast, safe disk-usage analyzer for Windows. It scans in seconds, finds junk and duplicate files, and shows exactly where your space goes.",
  "about.copyHint": "Click the address to copy it",
  "welcome.title": "Welcome to Greater",
  "welcome.subtitle": "Choose your language and theme. You can change both later in Settings.",
  "welcome.start": "Start using Greater",
  "toast.copied": "Email address copied",
  "btn.dismiss": "Dismiss",
  "btn.selectNone": "Select none",
  "btn.selectAll": "Select all",
  "btn.toRecycle": "Move to Recycle Bin",
  "btn.deletePerm": "Delete permanently",
  "btn.loadMore": "Load more",
  "btn.keepAll": "Keep all",
  "btn.selectAllDupes": "Select all duplicates",
  "btn.openLocation": "Open location",
  "btn.moveTrash": "Move to trash",
  "btn.ok": "Confirm",

  "explorer.pathPh": "Folder to scan, e.g. C:\\",
  "explorer.modeTitle": "Scanner mode",
  "explorer.footer": "scanning engine: FindFirstFileExW parallel walker · MFT fast path planned",
  "mode.fast": "fast (parallel)",
  "mode.simple": "simple (single thread)",
  "mode.portable": "portable (parallel, read_dir)",
  "mode.baseline": "baseline (read_dir)",
  "groupby.label": "List by",
  "groupby.title": "List every file, or roll them up by folder",
  "groupby.files": "By file",
  "groupby.folders": "By folder",
  "explorer.allFiles": "All files",
  "explorer.allFolders": "All folders",
  "explorer.emptyFiles": "No scan yet.",
  "explorer.emptyFolders": "No folders yet.",
  "list.filesLargest": "{n} files (largest first)",
  "list.filesLargestOf": "{shown} largest of {total} files",
  "list.foldersLargest": "{n} folders (largest first)",
  "list.foldersLargestOf": "{shown} largest of {total} folders",
  "col.name": "name",
  "col.size": "size",
  "col.files": "files",

  "stat.elapsed": "elapsed",
  "stat.files": "files",
  "stat.folders": "folders",
  "stat.size": "size",
  "stat.rate": "rate",
  "stat.skipped": "skipped",
  "stat.none": "none",
  "stat.scanned": "scanned",
  "stat.junkFiles": "junk files",
  "stat.reclaimable": "reclaimable",
  "stat.selected": "selected",
  "stat.groups": "groups",
  "stat.copies": "copies",
  "stat.totalSize": "total size",
  "stat.categories": "categories",
  "stat.largestType": "largest type",
  "status.ready": "Ready.",

  "drive.used": "used",
  "drive.free": "free",
  "drive.total": "total",
  "drive.internal": "internal",
  "drive.noDrives": "no drives",
  "drive.tooltip": "{letter}: — {used} used, {free} free of {total}",

  "clean.controls": "Hover a drive card, then click Clean.",
  "clean.controlsBusy": "Cleaning {path}…",
  "clean.idle": "Hover a drive card and press Clean to scan it for junk.",
  "clean.title": "Files to delete",
  "clean.all": "all",
  "clean.safe": "safe",
  "clean.optional": "optional",
  "clean.colFile": "file",
  "clean.colWhy": "why it is junk",
  "clean.checkAllTitle": "Select all listed",
  "clean.hintDefault": "Safe items are ticked by default.",
  "clean.emptyDefault": "Run a clean sweep to list junk files.",
  "clean.emptyNoMatch": "Nothing to clean here — no junk matched.",
  "clean.selectedNone": "none",
  "clean.selected": "{count} files · {size}",
  "clean.hintNothing": "Nothing to clean.",
  "clean.hintNone": "Nothing selected of {total} junk files.",
  "clean.hintSome": "{count} of {total} junk files selected · {size}.",
  "clean.scanning": "Scanning {path} for junk…",
  "clean.scanningProgress": "scanning… {files} files, {folders} folders",
  "clean.cancelling": "Cancelling — finishing current folder…",
  "clean.cancelled": "Cancelled after {secs} s — {files} junk files found.",
  "clean.nothing": "Nothing to clean on {path} — scanned {files} files in {secs} s.",
  "clean.found": "Found {files} files to remove — {size} reclaimable ({safe} safe · {optional} optional). Scanned {scanned} files in {secs} s.",
  "clean.deleted": "Deleted permanently",
  "clean.trashed": "Moved to Recycle Bin",
  "clean.result": "{verb}: {deleted} files, {size}.{failed}",
  "clean.failedNote": " {n} could not be removed (in use or access denied).",
  "clean.deleting": "Removing {done} of {total} files…",
  "status.deleting": "Deleting {name}…",
  "deleting.title": "Removing files…",
  "deleting.titleDone": "Done",
  "deleting.of": "of",
  "deleting.removedLabel": "removed",
  "deleting.current": "Deleting: {name}",
  "deleting.failed": "{n} could not be removed (in use or access denied).",
  "deleting.doneTrash": "Moved {n} files to the Recycle Bin.",
  "deleting.donePerm": "Permanently deleted {n} files.",
  "deleting.freed": "{size} freed so far",
  "deleting.stopping": "Stopping…",
  "deleting.titleCancelled": "Cancelled",

  "dupes.controls": "Hover a drive card, then click Find duplicates.",
  "dupes.controlsBusy": "Finding duplicates on {path}…",
  "dupes.idle": "Ready. Set a size floor, then run a drive.",
  "dupes.smallest": "smallest file",
  "dupes.smallest.title": "Ignore files smaller than this",
  "dupes.keep": "keep",
  "dupes.keep.title": "Which copy of each group to keep by default",
  "dupes.keepOldest": "oldest copy",
  "dupes.keepNewest": "newest copy",
  "dupes.keepShortest": "shortest path",
  "dupes.title": "Duplicate groups",
  "dupes.summary": "{groups} groups · {files} copies · {wasted} reclaimable",
  "dupes.hintDefault": "One copy per group is kept by default.",
  "dupes.hintEmpty": "No copies listed.",
  "dupes.hintNone": "Nothing selected — every copy of {groups} groups is being kept.",
  "dupes.hintSome": "{count} of {total} copies selected · {size}. One copy per group is always kept.",
  "dupes.emptyList": "No duplicates at this size floor.",
  "dupes.groupMeta": "{n} copies · {size} each · {wasted} reclaimable",
  "dupes.tagDelete": "delete",
  "dupes.tagKeep": "keep",
  "dupes.pickTitle": "Tick to delete this copy",
  "dupes.starTitle": "Keep only this copy",
  "dupes.scanning": "Scanning {path}, then reading shared-size files for duplicates…",
  "dupes.hashing": "checking duplicates… {files} files read",
  "dupes.scanningProgress": "scanning… {files} files, {folders} folders",
  "dupes.cancel": "Cancelling — finishing current file…",
  "dupes.cancelled": "Cancelled after {secs} s — {groups} duplicate groups found.",
  "dupes.none": "No duplicates on {path} at this size floor — scanned {files} files in {secs} s.",
  "dupes.found": "Found {groups} duplicate groups — {wasted} reclaimable across {copies} copies. Scanned {files} files in {secs} s.",
  "dupes.result": "{verb}: {deleted} files, {size}. {groups} groups left ({wasted} reclaimable).{failed}",

  "stats.controls": "Hover a drive card, then click Analyze.",
  "stats.controlsBusy": "Analyzing {path}…",
  "stats.title": "Statistics",
  "stats.subtitle": "space by file type — hover a drive, click Analyze",
  "stats.analyzing": "Analyzing {path} — scanning then grouping by file type…",
  "stats.cancelling": "Cancelling — finishing current folder…",
  "stats.scanningProgress": "scanning… {files} files, {folders} folders",
  "stats.noFiles": "no files",
  "stats.largest": "{name} · {size}",
  "stats.viewTotal": "{pct}% is {name} · {size} total",
  "stats.done": "Analyzed {files} files on {path} in {secs} s — grouped into {cats} types ({size}).",
  "stats.cancelled": "Cancelled after {secs} s — partial breakdown ({cats} types, {size}).",
  "stats.chartTitle": "{name} — {size} ({pct}%)",
  "stats.rowTitleDisk": "{name} — {size} · {pct}% of {disk} disk",
  "stats.rowTitleScanned": "{name} — {size} · {pct}% of {scanned} scanned",

  "modal.info.title": "File information",
  "modal.confirm.title": "Are you sure?",
  "modal.help.title": "Greater — Help & User Guide",
  "modal.settings.title": "Settings",
  "settings.appearance": "Appearance",
  "settings.themeNote": "System follows your Windows light/dark setting.",
  "theme.dark": "Dark",
  "theme.light": "Light",
  "theme.system": "System",
  "settings.language": "Language",
  "settings.langNote": "The interface updates immediately, help included.",
  "settings.theme": "Theme",

  "info.size": "size",
  "info.pctLargest": "% of largest",
  "info.extension": "extension",
  "info.folder": "folder",
  "info.modified": "modified",
  "info.created": "created",
  "info.accessed": "accessed",
  "info.bytes": "{n} bytes",
  "info.readonly": "read-only",
  "info.hidden": "hidden",
  "info.system": "system",
  "info.archive": "archive",
  "info.reparse": "reparse point",

  "row.moreInfo": "More info",
  "row.openLocation": "Open location",
  "row.trash": "Move to trash",
  "row.delete": "Delete permanently",

  "confirm.trashTitle": "Move to Recycle Bin?",
  "confirm.trashBody": "{name}\n\nYou can restore it from the Recycle Bin later.",
  "confirm.deleteTitle": "Delete permanently?",
  "confirm.deleteBody": "{name}\n\nThis bypasses the Recycle Bin. The file cannot be recovered.",
  "confirm.cleanBody": "{count} files, {size}.\n\n{note}",
  "confirm.permNote": "This bypasses the Recycle Bin and cannot be undone.",
  "confirm.cleanTrashNote": "Restorable from the Recycle Bin afterwards. Windows deletes items that are too big for the Recycle Bin structure permanently.",
  "confirm.dupBody": "{count} duplicate copies · {size}.\n\nOne copy of each group is always kept. {note}",
  "confirm.dupPermNote": "This bypasses the Recycle Bin; the files cannot be recovered.",
  "confirm.dupTrashNote": "Files go to the Recycle Bin. Very large ones may be deleted permanently instead.",

  "status.pickFolder": "Pick a drive or type a folder first.",
  "status.scanning": "Scanning {path}…",
  "status.cancelling": "Cancelling — finishing current folder…",
  "status.error": "error: {e}",
  "status.cancel": "cancel: {e}",
  "status.scanningProgress": "scanning… {files} files, {folders} folders",
  "status.done": "Done in {secs} s — {files} files, {size}.",
  "status.doneCancelled": "Cancelled after {secs} s — {files} files found.",
  "status.cancelledTag": " (cancelled)",
  "status.volumeFail": "volume list failed: {e}",
  "status.listenProgressFail": "listen progress failed: {e}",
  "status.listenDoneFail": "listen done failed: {e}",
  "status.moved": "Moved to Recycle Bin: {path}",
  "status.deleted": "Deleted permanently: {path}",

  "toast.moved": "moved to Recycle Bin: {name}",
  "toast.deleted": "deleted permanently: {name}",
  "toast.trashFail": "trash failed: {e}",
  "toast.deleteFail": "delete failed: {e}",
  "toast.opened": "opened location of {name}",
  "toast.openFail": "cannot open location: {e}",
  "toast.infoFail": "cannot open info: {e}",
  "toast.purged": "{verb}: {n} files",
  "toast.cleanFail": "clean failed: {e}",

  "junk.win-temp": "Windows Temp",
  "junk.user-temp": "Temporary files",
  "junk.pkg-temp": "App temp state",
  "junk.inetcache": "Internet cache",
  "junk.thumbs": "Thumbnail cache",
  "junk.browser-cache": "Browser cache",
  "junk.win-update-cache": "Windows Update cache",
  "junk.delivery-opt": "Delivery Optimization cache",
  "junk.recycle-bin": "Recycle Bin",
  "junk.crash-dumps": "Crash dumps",
  "junk.win-logs": "Windows logs",
  "junk.system-temp": "System temp",
  "junk.shader-cache": "GPU shader cache",
  "junk.servicing-cache": "Servicing cache",
  "junk.os-cache": "System cache",
  "junk.gpu-installer": "GPU installer leftovers",
  "junk.prefetch": "Prefetch data",
  "junk.windows-old": "Previous Windows install",
  "junk.package-cache": "Installer package cache",
  "junk.panther": "Setup logs",
  "junk.wer": "Crash reports",
  "junk.patch-cache": "Update patch cache",
  "junk.dev-cache": "Dev package cache",

  "junk.why.win-temp": "Scratch space Windows programs use while running. Recreated on demand; holds no user data.",
  "junk.why.system-temp": "System-wide scratch area for Windows services. Safe to clear; Windows recreates it.",
  "junk.why.user-temp": "Programs' temporary files for this account. Recreated on demand; holds no user data.",
  "junk.why.pkg-temp": "Store-app temporary state while it runs. Recreated by the app on next launch.",
  "junk.why.inetcache": "Internet Explorer / system web cache. Regenerated by browsing.",
  "junk.why.thumbs": "Thumbnail and icon cache. Windows rebuilds these automatically.",
  "junk.why.browser-cache": "Browser page/GPU shader cache. Regenerated by browsing.",
  "junk.why.win-update-cache": "Downloaded Windows Update payloads already installed. Re-downloaded only if needed again.",
  "junk.why.delivery-opt": "Delivery Optimization peer/download cache. Windows manages and refills it.",
  "junk.why.recycle-bin": "Files you already deleted, still recoverable until emptied.",
  "junk.why.crash-dumps": "Kernel/application crash dumps (incl. MEMORY.DMP) kept for debugging after a crash. Windows writes a new one if it crashes again.",
  "junk.why.win-logs": "Old Windows log files. Only used for troubleshooting; new logs are written continuously.",
  "junk.why.servicing-cache": "Temporary staging for Windows servicing/WinSxS updates. Windows recreates it.",
  "junk.why.os-cache": "Windows component cache files. Regenerated by the shell.",
  "junk.why.shader-cache": "GPU shader caches (DirectX/NVIDIA/AMD). Rebuilt the next time games/apps run.",
  "junk.why.gpu-installer": "Leftover GPU driver installer packages/cache. Safe to remove; drivers are already installed.",
  "junk.why.prefetch": "Windows app-launch prefetch hints. Deleting only slows the first few launches while they rebuild.",
  "junk.why.windows-old": "A previous Windows installation kept for 10 days for rollback. Deleting frees a lot; you can no longer roll back.",
  "junk.why.package-cache": "Installer payloads for repair/uninstall. Removing means big installers must be re-downloaded.",
  "junk.why.panther": "Windows Setup logs. For troubleshooting upgrades; safe to remove.",
  "junk.why.wer": "Windows Error Reporting crash reports. Safe to remove; only used to report bugs.",
  "junk.why.patch-cache": "Cached Windows patch payloads. Removing means repair/patching re-downloads them.",
  "junk.why.dev-cache": "Developer package caches (npm/pip/Cargo/NuGet/Gradle/Maven/Go). Re-downloaded on next build.",

  "bucket.images": "Images",
  "bucket.videos": "Videos",
  "bucket.audio": "Audio",
  "bucket.documents": "Documents",
  "bucket.archives": "Archives",
  "bucket.executables": "Executables",
  "bucket.code": "Code",
  "bucket.other": "Other",

  "unit.file": "file",
  "unit.files": "files",
  "unit.copy": "copy",
  "unit.copies": "copies",
};

I18N.fr = {
  "app.tagline": "analyseur d'espace disque",
  "app.sections": "Sections",
  "tab.explorer": "Explorateur",
  "tab.clean": "Nettoyage",
  "tab.dupes": "Doublons",
  "tab.stats": "Statistiques",
  "header.elevated": "élevé",

  "btn.help": "Aide",
  "btn.help.title": "Aide — à quoi sert cette application ?",
  "btn.settings": "Paramètres",
  "btn.settings.title": "Paramètres — apparence et langue",
  "btn.scan": "Analyser",
  "btn.cancel": "Annuler",
  "btn.close": "Fermer",
  "btn.about": "À propos",
  "about.title": "À propos de Greater",
  "about.version": "Version 1.0",
  "about.developer": "Développeur",
  "about.company": "Société",
  "about.email": "Contact",
  "about.desc": "Un analyseur d'espace disque rapide et sûr pour Windows. Il analyse en quelques secondes, trouve les fichiers inutiles et les doublons, et montre exactement où passe votre espace.",
  "about.copyHint": "Cliquez sur l'adresse pour la copier",
  "welcome.title": "Bienvenue dans Greater",
  "welcome.subtitle": "Choisissez votre langue et votre thème. Vous pourrez modifier les deux plus tard dans les Paramètres.",
  "welcome.start": "Commencer avec Greater",
  "toast.copied": "Adresse e-mail copiée",
  "btn.dismiss": "Ignorer",
  "btn.selectNone": "Tout désélectionner",
  "btn.selectAll": "Tout sélectionner",
  "btn.toRecycle": "Mettre à la corbeille",
  "btn.deletePerm": "Supprimer définitivement",
  "btn.loadMore": "Charger plus",
  "btn.keepAll": "Tout conserver",
  "btn.selectAllDupes": "Sélectionner tous les doublons",
  "btn.openLocation": "Ouvrir l'emplacement",
  "btn.moveTrash": "Mettre à la corbeille",
  "btn.ok": "Confirmer",

  "explorer.pathPh": "Dossier à analyser, ex. C:\\",
  "explorer.modeTitle": "Mode d'analyse",
  "explorer.footer": "moteur : parcours parallèle FindFirstFileExW · accès direct MFT prévu",
  "mode.fast": "rapide (parallèle)",
  "mode.simple": "simple (mono-thread)",
  "mode.portable": "portable (parallèle, read_dir)",
  "mode.baseline": "référence (read_dir)",
  "groupby.label": "Lister par",
  "groupby.title": "Lister chaque fichier, ou les regrouper par dossier",
  "groupby.files": "Par fichier",
  "groupby.folders": "Par dossier",
  "explorer.allFiles": "Tous les fichiers",
  "explorer.allFolders": "Tous les dossiers",
  "explorer.emptyFiles": "Aucune analyse pour l'instant.",
  "explorer.emptyFolders": "Aucun dossier pour l'instant.",
  "list.filesLargest": "{n} fichiers (du plus gros au plus petit)",
  "list.filesLargestOf": "{shown} plus gros fichiers sur {total}",
  "list.foldersLargest": "{n} dossiers (du plus gros au plus petit)",
  "list.foldersLargestOf": "{shown} plus gros dossiers sur {total}",
  "col.name": "nom",
  "col.size": "taille",
  "col.files": "fichiers",

  "stat.elapsed": "durée",
  "stat.files": "fichiers",
  "stat.folders": "dossiers",
  "stat.size": "taille",
  "stat.rate": "débit",
  "stat.skipped": "ignorés",
  "stat.none": "aucun",
  "stat.scanned": "analysés",
  "stat.junkFiles": "fichiers inutiles",
  "stat.reclaimable": "récupérable",
  "stat.selected": "sélectionnés",
  "stat.groups": "groupes",
  "stat.copies": "copies",
  "stat.totalSize": "taille totale",
  "stat.categories": "catégories",
  "stat.largestType": "type principal",
  "status.ready": "Prêt.",

  "drive.used": "utilisé",
  "drive.free": "libre",
  "drive.total": "total",
  "drive.internal": "interne",
  "drive.noDrives": "aucun lecteur",
  "drive.tooltip": "{letter}: — {used} utilisés, {free} libres sur {total}",

  "clean.controls": "Survolez un lecteur, puis cliquez sur Nettoyer.",
  "clean.controlsBusy": "Nettoyage de {path}…",
  "clean.idle": "Survolez un lecteur et cliquez sur Nettoyer pour y chercher des fichiers inutiles.",
  "clean.title": "Fichiers à supprimer",
  "clean.all": "tous",
  "clean.safe": "sûrs",
  "clean.optional": "facultatifs",
  "clean.colFile": "fichier",
  "clean.colWhy": "pourquoi c'est inutile",
  "clean.checkAllTitle": "Tout sélectionner dans la liste",
  "clean.hintDefault": "Les éléments sûrs sont cochés par défaut.",
  "clean.emptyDefault": "Lancez un nettoyage pour lister les fichiers inutiles.",
  "clean.emptyNoMatch": "Rien à nettoyer ici — aucun fichier inutile trouvé.",
  "clean.selectedNone": "aucun",
  "clean.selected": "{count} fichiers · {size}",
  "clean.hintNothing": "Rien à nettoyer.",
  "clean.hintNone": "Aucun fichier sélectionné sur {total} fichiers inutiles.",
  "clean.hintSome": "{count} fichiers inutiles sélectionnés sur {total} · {size}.",
  "clean.scanning": "Recherche de fichiers inutiles sur {path}…",
  "clean.scanningProgress": "analyse… {files} fichiers, {folders} dossiers",
  "clean.cancelling": "Annulation — fin du dossier en cours…",
  "clean.cancelled": "Annulé après {secs} s — {files} fichiers inutiles trouvés.",
  "clean.nothing": "Rien à nettoyer sur {path} — {files} fichiers analysés en {secs} s.",
  "clean.found": "{files} fichiers à supprimer — {size} récupérables ({safe} sûrs · {optional} facultatifs). {scanned} fichiers analysés en {secs} s.",
  "clean.deleted": "Supprimés définitivement",
  "clean.trashed": "Mis à la corbeille",
  "clean.result": "{verb} : {deleted} fichiers, {size}.{failed}",
  "clean.failedNote": " {n} n'ont pas pu être supprimés (en cours d'utilisation ou accès refusé).",
  "clean.deleting": "Suppression de {done} sur {total} fichiers…",
  "status.deleting": "Suppression de {name}…",
  "deleting.title": "Suppression des fichiers…",
  "deleting.titleDone": "Terminé",
  "deleting.of": "sur",
  "deleting.removedLabel": "supprimés",
  "deleting.current": "Suppression : {name}",
  "deleting.failed": "{n} n'ont pas pu être supprimés (en cours d'utilisation ou accès refusé).",
  "deleting.doneTrash": "{n} fichiers déplacés vers la corbeille.",
  "deleting.donePerm": "{n} fichiers supprimés définitivement.",
  "deleting.freed": "{size} libérés jusqu'à présent",
  "deleting.stopping": "Arrêt…",
  "deleting.titleCancelled": "Annulé",

  "dupes.controls": "Survolez un lecteur, puis cliquez sur Chercher les doublons.",
  "dupes.controlsBusy": "Recherche de doublons sur {path}…",
  "dupes.idle": "Prêt. Choisissez une taille minimale, puis lancez un lecteur.",
  "dupes.smallest": "fichier minimal",
  "dupes.smallest.title": "Ignorer les fichiers plus petits que cette taille",
  "dupes.keep": "conserver",
  "dupes.keep.title": "Quelle copie de chaque groupe conserver par défaut",
  "dupes.keepOldest": "copie la plus ancienne",
  "dupes.keepNewest": "copie la plus récente",
  "dupes.keepShortest": "chemin le plus court",
  "dupes.title": "Groupes de doublons",
  "dupes.summary": "{groups} groupes · {files} copies · {wasted} récupérables",
  "dupes.hintDefault": "Une copie par groupe est conservée par défaut.",
  "dupes.hintEmpty": "Aucune copie listée.",
  "dupes.hintNone": "Aucune sélection — toutes les copies des {groups} groupes sont conservées.",
  "dupes.hintSome": "{count} copies sélectionnées sur {total} · {size}. Une copie par groupe est toujours conservée.",
  "dupes.emptyList": "Aucun doublon à cette taille minimale.",
  "dupes.groupMeta": "{n} copies · {size} chacune · {wasted} récupérables",
  "dupes.tagDelete": "supprimer",
  "dupes.tagKeep": "conserver",
  "dupes.pickTitle": "Cocher pour supprimer cette copie",
  "dupes.starTitle": "Ne conserver que cette copie",
  "dupes.scanning": "Analyse de {path}, puis lecture des fichiers de taille partagée…",
  "dupes.hashing": "vérification des doublons… {files} fichiers lus",
  "dupes.scanningProgress": "analyse… {files} fichiers, {folders} dossiers",
  "dupes.cancel": "Annulation — fin du fichier en cours…",
  "dupes.cancelled": "Annulé après {secs} s — {groups} groupes de doublons trouvés.",
  "dupes.none": "Aucun doublon sur {path} à cette taille minimale — {files} fichiers analysés en {secs} s.",
  "dupes.found": "{groups} groupes de doublons trouvés — {wasted} récupérables sur {copies} copies. {files} fichiers analysés en {secs} s.",
  "dupes.result": "{verb} : {deleted} fichiers, {size}. {groups} groupes restants ({wasted} récupérables).{failed}",

  "stats.controls": "Survolez un lecteur, puis cliquez sur Analyser.",
  "stats.controlsBusy": "Analyse de {path}…",
  "stats.title": "Statistiques",
  "stats.subtitle": "espace par type de fichier — survolez un lecteur, cliquez sur Analyser",
  "stats.analyzing": "Analyse de {path} — parcours puis regroupement par type de fichier…",
  "stats.cancelling": "Annulation — fin du dossier en cours…",
  "stats.scanningProgress": "analyse… {files} fichiers, {folders} dossiers",
  "stats.noFiles": "aucun fichier",
  "stats.largest": "{name} · {size}",
  "stats.viewTotal": "{pct} % est {name} · {size} au total",
  "stats.done": "{files} fichiers analysés sur {path} en {secs} s — répartis en {cats} types ({size}).",
  "stats.cancelled": "Annulé après {secs} s — répartition partielle ({cats} types, {size}).",
  "stats.chartTitle": "{name} — {size} ({pct} %)",
  "stats.rowTitleDisk": "{name} — {size} · {pct} % du disque {disk}",
  "stats.rowTitleScanned": "{name} — {size} · {pct} % des {scanned} analysés",

  "modal.info.title": "Informations sur le fichier",
  "modal.confirm.title": "Êtes-vous sûr ?",
  "modal.help.title": "Greater — Aide et guide d'utilisation",
  "modal.settings.title": "Paramètres",
  "settings.appearance": "Apparence",
  "settings.themeNote": "Système suit le mode clair/sombre de Windows.",
  "theme.dark": "Sombre",
  "theme.light": "Clair",
  "theme.system": "Système",
  "settings.language": "Langue",
  "settings.langNote": "L'interface est mise à jour immédiatement, aide comprise.",
  "settings.theme": "Thème",

  "info.size": "taille",
  "info.pctLargest": "% du plus gros",
  "info.extension": "extension",
  "info.folder": "dossier",
  "info.modified": "modifié",
  "info.created": "créé",
  "info.accessed": "consulté",
  "info.bytes": "{n} octets",
  "info.readonly": "lecture seule",
  "info.hidden": "caché",
  "info.system": "système",
  "info.archive": "archive",
  "info.reparse": "point d'analyse",

  "row.moreInfo": "Plus d'infos",
  "row.openLocation": "Ouvrir l'emplacement",
  "row.trash": "Mettre à la corbeille",
  "row.delete": "Supprimer définitivement",

  "confirm.trashTitle": "Mettre à la corbeille ?",
  "confirm.trashBody": "{name}\n\nVous pourrez le restaurer depuis la corbeille.",
  "confirm.deleteTitle": "Supprimer définitivement ?",
  "confirm.deleteBody": "{name}\n\nCela contourne la corbeille. Le fichier ne pourra pas être récupéré.",
  "confirm.cleanBody": "{count} fichiers, {size}.\n\n{note}",
  "confirm.permNote": "Cela contourne la corbeille et est irréversible.",
  "confirm.cleanTrashNote": "Restaurables ensuite depuis la corbeille. Windows supprime définitivement les éléments trop volumineux pour la corbeille.",
  "confirm.dupBody": "{count} copies en double · {size}.\n\nUne copie par groupe est toujours conservée. {note}",
  "confirm.dupPermNote": "Cela contourne la corbeille ; les fichiers ne pourront pas être récupérés.",
  "confirm.dupTrashNote": "Les fichiers vont à la corbeille. Les plus volumineux peuvent être supprimés définitivement.",

  "status.pickFolder": "Choisissez d'abord un lecteur ou saisissez un dossier.",
  "status.scanning": "Analyse de {path}…",
  "status.cancelling": "Annulation — fin du dossier en cours…",
  "status.error": "erreur : {e}",
  "status.cancel": "annulation : {e}",
  "status.scanningProgress": "analyse… {files} fichiers, {folders} dossiers",
  "status.done": "Terminé en {secs} s — {files} fichiers, {size}.",
  "status.doneCancelled": "Annulé après {secs} s — {files} fichiers trouvés.",
  "status.cancelledTag": " (annulé)",
  "status.volumeFail": "échec de la liste des lecteurs : {e}",
  "status.listenProgressFail": "échec de l'écoute des progrès : {e}",
  "status.listenDoneFail": "échec de l'écoute de la fin : {e}",
  "status.moved": "Mis à la corbeille : {path}",
  "status.deleted": "Supprimé définitivement : {path}",

  "toast.moved": "mis à la corbeille : {name}",
  "toast.deleted": "supprimé définitivement : {name}",
  "toast.trashFail": "échec de la mise à la corbeille : {e}",
  "toast.deleteFail": "échec de la suppression : {e}",
  "toast.opened": "emplacement de {name} ouvert",
  "toast.openFail": "impossible d'ouvrir l'emplacement : {e}",
  "toast.infoFail": "impossible d'ouvrir les infos : {e}",
  "toast.purged": "{verb} : {n} fichiers",
  "toast.cleanFail": "échec du nettoyage : {e}",

  "junk.win-temp": "Temp Windows",
  "junk.user-temp": "Fichiers temporaires",
  "junk.pkg-temp": "État temporaire d'applications",
  "junk.inetcache": "Cache Internet",
  "junk.thumbs": "Cache des vignettes",
  "junk.browser-cache": "Cache du navigateur",
  "junk.win-update-cache": "Cache de Windows Update",
  "junk.delivery-opt": "Cache d'Optimisation de la distribution",
  "junk.recycle-bin": "Corbeille",
  "junk.crash-dumps": "Vidages mémoire",
  "junk.win-logs": "Journaux Windows",
  "junk.system-temp": "Temp système",
  "junk.shader-cache": "Cache de shaders GPU",
  "junk.servicing-cache": "Cache de maintenance",
  "junk.os-cache": "Cache système",
  "junk.gpu-installer": "Restes d'installateurs GPU",
  "junk.prefetch": "Données Prefetch",
  "junk.windows-old": "Installation Windows précédente",
  "junk.package-cache": "Cache de paquets d'installation",
  "junk.panther": "Journaux d'installation",
  "junk.wer": "Rapports d'erreur",
  "junk.patch-cache": "Cache de correctifs",
  "junk.dev-cache": "Cache de paquets dev",

  "junk.why.win-temp": "Espace de travail des programmes Windows pendant leur exécution. Recréé à la demande ; aucune donnée utilisateur.",
  "junk.why.system-temp": "Zone de travail système pour les services Windows. Suppression sans risque ; Windows la recrée.",
  "junk.why.user-temp": "Fichiers temporaires des programmes de ce compte. Recréés à la demande ; aucune donnée utilisateur.",
  "junk.why.pkg-temp": "État temporaire des applications du Store pendant leur exécution. Recréé au prochain lancement.",
  "junk.why.inetcache": "Cache web d'Internet Explorer / du système. Régénéré par la navigation.",
  "junk.why.thumbs": "Cache des vignettes et icônes. Windows le reconstruit automatiquement.",
  "junk.why.browser-cache": "Cache de pages/shaders GPU du navigateur. Régénéré par la navigation.",
  "junk.why.win-update-cache": "Correctifs Windows téléchargés et déjà installés. Retéléchargés seulement si nécessaire.",
  "junk.why.delivery-opt": "Cache de téléchargement/partage d'Optimisation de la distribution. Géré et rempli par Windows.",
  "junk.why.recycle-bin": "Fichiers déjà supprimés, encore récupérables tant que la corbeille n'est pas vidée.",
  "junk.why.crash-dumps": "Vidages mémoire noyau/application (dont MEMORY.DMP) conservés pour le débogage. Windows en écrit un nouveau en cas de nouveau plantage.",
  "junk.why.win-logs": "Anciens journaux Windows. Utiles seulement au dépannage ; de nouveaux journaux sont écrits en continu.",
  "junk.why.servicing-cache": "Zone de préparation temporaire des mises à jour WinSxS. Windows la recrée.",
  "junk.why.os-cache": "Fichiers de cache des composants Windows. Régénérés par le shell.",
  "junk.why.shader-cache": "Caches de shaders GPU (DirectX/NVIDIA/AMD). Reconstruits au prochain lancement des jeux/applications.",
  "junk.why.gpu-installer": "Paquets/caches d'installateurs de pilotes GPU restants. Suppression sans risque ; les pilotes sont déjà installés.",
  "junk.why.prefetch": "Indices Prefetch de lancement d'applications. Les supprimer ne ralentit que les premiers lancements, le temps qu'ils se reconstruisent.",
  "junk.why.windows-old": "Installation Windows précédente conservée 10 jours pour un retour arrière. La supprimer libère beaucoup d'espace ; le retour arrière devient impossible.",
  "junk.why.package-cache": "Paquets d'installation pour réparation/désinstallation. Les supprimer oblige à retélécharger les gros installateurs.",
  "junk.why.panther": "Journaux d'installation de Windows. Utiles au dépannage des mises à niveau ; suppression sans risque.",
  "junk.why.wer": "Rapports de plantage du Rapport d'erreurs Windows. Suppression sans risque ; servent seulement à signaler des bugs.",
  "junk.why.patch-cache": "Correctifs Windows en cache. Les supprimer oblige à les retélécharger pour réparer/mettre à jour.",
  "junk.why.dev-cache": "Caches de paquets de développement (npm/pip/Cargo/NuGet/Gradle/Maven/Go). Retéléchargés à la prochaine compilation.",

  "bucket.images": "Images",
  "bucket.videos": "Vidéos",
  "bucket.audio": "Audio",
  "bucket.documents": "Documents",
  "bucket.archives": "Archives",
  "bucket.executables": "Exécutables",
  "bucket.code": "Code",
  "bucket.other": "Autre",

  "unit.file": "fichier",
  "unit.files": "fichiers",
  "unit.copy": "copie",
  "unit.copies": "copies",
};

I18N.es = {
  "app.tagline": "analizador de espacio en disco",
  "app.sections": "Secciones",
  "tab.explorer": "Explorador",
  "tab.clean": "Limpieza",
  "tab.dupes": "Duplicados",
  "tab.stats": "Estadísticas",
  "header.elevated": "elevado",

  "btn.help": "Ayuda",
  "btn.help.title": "Ayuda — ¿qué hace esta aplicación?",
  "btn.settings": "Ajustes",
  "btn.settings.title": "Ajustes — apariencia e idioma",
  "btn.scan": "Analizar",
  "btn.cancel": "Cancelar",
  "btn.close": "Cerrar",
  "btn.about": "Acerca de",
  "about.title": "Acerca de Greater",
  "about.version": "Versión 1.0",
  "about.developer": "Desarrollador",
  "about.company": "Empresa",
  "about.email": "Contacto",
  "about.desc": "Un analizador de uso de disco rápido y seguro para Windows. Analiza en segundos, encuentra archivos basura y duplicados, y muestra exactamente dónde se va tu espacio.",
  "about.copyHint": "Haz clic en la dirección para copiarla",
  "welcome.title": "Bienvenido a Greater",
  "welcome.subtitle": "Elige tu idioma y tema. Puedes cambiar ambos más tarde en Ajustes.",
  "welcome.start": "Empezar a usar Greater",
  "toast.copied": "Dirección de correo copiada",
  "btn.dismiss": "Descartar",
  "btn.selectNone": "Deseleccionar todo",
  "btn.selectAll": "Seleccionar todo",
  "btn.toRecycle": "Mover a la Papelera",
  "btn.deletePerm": "Eliminar permanentemente",
  "btn.loadMore": "Cargar más",
  "btn.keepAll": "Conservar todo",
  "btn.selectAllDupes": "Seleccionar todos los duplicados",
  "btn.openLocation": "Abrir ubicación",
  "btn.moveTrash": "Mover a la papelera",
  "btn.ok": "Confirmar",

  "explorer.pathPh": "Carpeta a analizar, p. ej. C:\\",
  "explorer.modeTitle": "Modo de análisis",
  "explorer.footer": "motor: recorrido paralelo FindFirstFileExW · acceso directo MFT previsto",
  "mode.fast": "rápido (paralelo)",
  "mode.simple": "simple (un hilo)",
  "mode.portable": "portátil (paralelo, read_dir)",
  "mode.baseline": "referencia (read_dir)",
  "groupby.label": "Mostrar por",
  "groupby.title": "Mostrar cada archivo, o agruparlos por carpeta",
  "groupby.files": "Por archivo",
  "groupby.folders": "Por carpeta",
  "explorer.allFiles": "Todos los archivos",
  "explorer.allFolders": "Todas las carpetas",
  "explorer.emptyFiles": "Aún no hay análisis.",
  "explorer.emptyFolders": "Aún no hay carpetas.",
  "list.filesLargest": "{n} archivos (del mayor al menor)",
  "list.filesLargestOf": "{shown} más grandes de {total} archivos",
  "list.foldersLargest": "{n} carpetas (de mayor a menor)",
  "list.foldersLargestOf": "{shown} más grandes de {total} carpetas",
  "col.name": "nombre",
  "col.size": "tamaño",
  "col.files": "archivos",

  "stat.elapsed": "tiempo",
  "stat.files": "archivos",
  "stat.folders": "carpetas",
  "stat.size": "tamaño",
  "stat.rate": "velocidad",
  "stat.skipped": "omitidos",
  "stat.none": "ninguno",
  "stat.scanned": "analizados",
  "stat.junkFiles": "archivos basura",
  "stat.reclaimable": "recuperable",
  "stat.selected": "seleccionados",
  "stat.groups": "grupos",
  "stat.copies": "copias",
  "stat.totalSize": "tamaño total",
  "stat.categories": "categorías",
  "stat.largestType": "tipo principal",
  "status.ready": "Listo.",

  "drive.used": "usado",
  "drive.free": "libre",
  "drive.total": "total",
  "drive.internal": "interno",
  "drive.noDrives": "sin unidades",
  "drive.tooltip": "{letter}: — {used} usados, {free} libres de {total}",

  "clean.controls": "Pase el cursor por una unidad y pulse Limpiar.",
  "clean.controlsBusy": "Limpiando {path}…",
  "clean.idle": "Pase el cursor por una unidad y pulse Limpiar para buscar archivos basura.",
  "clean.title": "Archivos a eliminar",
  "clean.all": "todos",
  "clean.safe": "seguros",
  "clean.optional": "opcionales",
  "clean.colFile": "archivo",
  "clean.colWhy": "por qué es basura",
  "clean.checkAllTitle": "Seleccionar todo lo listado",
  "clean.hintDefault": "Los elementos seguros están marcados por defecto.",
  "clean.emptyDefault": "Ejecute una limpieza para listar archivos basura.",
  "clean.emptyNoMatch": "Nada que limpiar aquí — no se encontró basura.",
  "clean.selectedNone": "ninguno",
  "clean.selected": "{count} archivos · {size}",
  "clean.hintNothing": "Nada que limpiar.",
  "clean.hintNone": "Ninguno seleccionado de {total} archivos basura.",
  "clean.hintSome": "{count} de {total} archivos basura seleccionados · {size}.",
  "clean.scanning": "Buscando basura en {path}…",
  "clean.scanningProgress": "analizando… {files} archivos, {folders} carpetas",
  "clean.cancelling": "Cancelando — terminando la carpeta actual…",
  "clean.cancelled": "Cancelado tras {secs} s — {files} archivos basura encontrados.",
  "clean.nothing": "Nada que limpiar en {path} — {files} archivos analizados en {secs} s.",
  "clean.found": "{files} archivos para eliminar — {size} recuperables ({safe} seguros · {optional} opcionales). {scanned} archivos analizados en {secs} s.",
  "clean.deleted": "Eliminados permanentemente",
  "clean.trashed": "Movidos a la Papelera",
  "clean.result": "{verb}: {deleted} archivos, {size}.{failed}",
  "clean.failedNote": " {n} no se pudieron eliminar (en uso o acceso denegado).",
  "clean.deleting": "Eliminando {done} de {total} archivos…",
  "status.deleting": "Eliminando {name}…",
  "deleting.title": "Eliminando archivos…",
  "deleting.titleDone": "Completado",
  "deleting.of": "de",
  "deleting.removedLabel": "eliminados",
  "deleting.current": "Eliminando: {name}",
  "deleting.failed": "{n} no se pudieron eliminar (en uso o acceso denegado).",
  "deleting.doneTrash": "{n} archivos movidos a la Papelera.",
  "deleting.donePerm": "{n} archivos eliminados permanentemente.",
  "deleting.freed": "{size} liberados hasta ahora",
  "deleting.stopping": "Deteniendo…",
  "deleting.titleCancelled": "Cancelado",

  "dupes.controls": "Pase el cursor por una unidad y pulse Buscar duplicados.",
  "dupes.controlsBusy": "Buscando duplicados en {path}…",
  "dupes.idle": "Listo. Elija un tamaño mínimo y ejecute una unidad.",
  "dupes.smallest": "archivo mínimo",
  "dupes.smallest.title": "Ignorar archivos menores que este tamaño",
  "dupes.keep": "conservar",
  "dupes.keep.title": "Qué copia de cada grupo conservar por defecto",
  "dupes.keepOldest": "copia más antigua",
  "dupes.keepNewest": "copia más reciente",
  "dupes.keepShortest": "ruta más corta",
  "dupes.title": "Grupos de duplicados",
  "dupes.summary": "{groups} grupos · {files} copias · {wasted} recuperables",
  "dupes.hintDefault": "Se conserva una copia por grupo por defecto.",
  "dupes.hintEmpty": "No hay copias listadas.",
  "dupes.hintNone": "Nada seleccionado — se conservan todas las copias de {groups} grupos.",
  "dupes.hintSome": "{count} de {total} copias seleccionadas · {size}. Siempre se conserva una copia por grupo.",
  "dupes.emptyList": "No hay duplicados con este tamaño mínimo.",
  "dupes.groupMeta": "{n} copias · {size} cada una · {wasted} recuperables",
  "dupes.tagDelete": "eliminar",
  "dupes.tagKeep": "conservar",
  "dupes.pickTitle": "Marcar para eliminar esta copia",
  "dupes.starTitle": "Conservar solo esta copia",
  "dupes.scanning": "Analizando {path} y leyendo archivos de tamaño compartido…",
  "dupes.hashing": "comprobando duplicados… {files} archivos leídos",
  "dupes.scanningProgress": "analizando… {files} archivos, {folders} carpetas",
  "dupes.cancel": "Cancelando — terminando el archivo actual…",
  "dupes.cancelled": "Cancelado tras {secs} s — {groups} grupos de duplicados encontrados.",
  "dupes.none": "Sin duplicados en {path} con este tamaño mínimo — {files} archivos analizados en {secs} s.",
  "dupes.found": "{groups} grupos de duplicados encontrados — {wasted} recuperables entre {copies} copias. {files} archivos analizados en {secs} s.",
  "dupes.result": "{verb}: {deleted} archivos, {size}. Quedan {groups} grupos ({wasted} recuperables).{failed}",

  "stats.controls": "Pase el cursor por una unidad y pulse Analizar.",
  "stats.controlsBusy": "Analizando {path}…",
  "stats.title": "Estadísticas",
  "stats.subtitle": "espacio por tipo de archivo — pase el cursor por una unidad y pulse Analizar",
  "stats.analyzing": "Analizando {path} — recorrido y agrupación por tipo de archivo…",
  "stats.cancelling": "Cancelando — terminando la carpeta actual…",
  "stats.scanningProgress": "analizando… {files} archivos, {folders} carpetas",
  "stats.noFiles": "sin archivos",
  "stats.largest": "{name} · {size}",
  "stats.viewTotal": "{pct} % es {name} · {size} en total",
  "stats.done": "{files} archivos analizados en {path} en {secs} s — agrupados en {cats} tipos ({size}).",
  "stats.cancelled": "Cancelado tras {secs} s — desglose parcial ({cats} tipos, {size}).",
  "stats.chartTitle": "{name} — {size} ({pct} %)",
  "stats.rowTitleDisk": "{name} — {size} · {pct} % del disco {disk}",
  "stats.rowTitleScanned": "{name} — {size} · {pct} % de {scanned} analizados",

  "modal.info.title": "Información del archivo",
  "modal.confirm.title": "¿Está seguro?",
  "modal.help.title": "Greater — Ayuda y guía de uso",
  "modal.settings.title": "Ajustes",
  "settings.appearance": "Apariencia",
  "settings.themeNote": "Sistema sigue el modo claro/oscuro de Windows.",
  "theme.dark": "Oscuro",
  "theme.light": "Claro",
  "theme.system": "Sistema",
  "settings.language": "Idioma",
  "settings.langNote": "La interfaz se actualiza al instante, incluida la ayuda.",
  "settings.theme": "Tema",

  "info.size": "tamaño",
  "info.pctLargest": "% del mayor",
  "info.extension": "extensión",
  "info.folder": "carpeta",
  "info.modified": "modificado",
  "info.created": "creado",
  "info.accessed": "accedido",
  "info.bytes": "{n} bytes",
  "info.readonly": "solo lectura",
  "info.hidden": "oculto",
  "info.system": "sistema",
  "info.archive": "archivo",
  "info.reparse": "punto de reanálisis",

  "row.moreInfo": "Más información",
  "row.openLocation": "Abrir ubicación",
  "row.trash": "Mover a la papelera",
  "row.delete": "Eliminar permanentemente",

  "confirm.trashTitle": "¿Mover a la Papelera?",
  "confirm.trashBody": "{name}\n\nPodrá restaurarlo desde la Papelera más tarde.",
  "confirm.deleteTitle": "¿Eliminar permanentemente?",
  "confirm.deleteBody": "{name}\n\nEsto omite la Papelera. El archivo no se podrá recuperar.",
  "confirm.cleanBody": "{count} archivos, {size}.\n\n{note}",
  "confirm.permNote": "Esto omite la Papelera y no se puede deshacer.",
  "confirm.cleanTrashNote": "Se podrán restaurar desde la Papelera. Windows elimina permanentemente los elementos demasiado grandes para la Papelera.",
  "confirm.dupBody": "{count} copias duplicadas · {size}.\n\nSiempre se conserva una copia de cada grupo. {note}",
  "confirm.dupPermNote": "Esto omite la Papelera; los archivos no se podrán recuperar.",
  "confirm.dupTrashNote": "Los archivos van a la Papelera. Los muy grandes pueden eliminarse permanentemente.",

  "status.pickFolder": "Elija una unidad o escriba una carpeta primero.",
  "status.scanning": "Analizando {path}…",
  "status.cancelling": "Cancelando — terminando la carpeta actual…",
  "status.error": "error: {e}",
  "status.cancel": "cancelar: {e}",
  "status.scanningProgress": "analizando… {files} archivos, {folders} carpetas",
  "status.done": "Hecho en {secs} s — {files} archivos, {size}.",
  "status.doneCancelled": "Cancelado tras {secs} s — {files} archivos encontrados.",
  "status.cancelledTag": " (cancelado)",
  "status.volumeFail": "fallo al listar unidades: {e}",
  "status.listenProgressFail": "fallo al escuchar el progreso: {e}",
  "status.listenDoneFail": "fallo al escuchar el fin: {e}",
  "status.moved": "Movido a la Papelera: {path}",
  "status.deleted": "Eliminado permanentemente: {path}",

  "toast.moved": "movido a la Papelera: {name}",
  "toast.deleted": "eliminado permanentemente: {name}",
  "toast.trashFail": "fallo al mover a la papelera: {e}",
  "toast.deleteFail": "fallo al eliminar: {e}",
  "toast.opened": "ubicación de {name} abierta",
  "toast.openFail": "no se puede abrir la ubicación: {e}",
  "toast.infoFail": "no se puede abrir la información: {e}",
  "toast.purged": "{verb}: {n} archivos",
  "toast.cleanFail": "fallo en la limpieza: {e}",

  "junk.win-temp": "Temp de Windows",
  "junk.user-temp": "Archivos temporales",
  "junk.pkg-temp": "Estado temporal de apps",
  "junk.inetcache": "Caché de Internet",
  "junk.thumbs": "Caché de miniaturas",
  "junk.browser-cache": "Caché del navegador",
  "junk.win-update-cache": "Caché de Windows Update",
  "junk.delivery-opt": "Caché de Optimización de entrega",
  "junk.recycle-bin": "Papelera de reciclaje",
  "junk.crash-dumps": "Volcados de fallos",
  "junk.win-logs": "Registros de Windows",
  "junk.system-temp": "Temp del sistema",
  "junk.shader-cache": "Caché de shaders GPU",
  "junk.servicing-cache": "Caché de mantenimiento",
  "junk.os-cache": "Caché del sistema",
  "junk.gpu-installer": "Restos de instaladores GPU",
  "junk.prefetch": "Datos Prefetch",
  "junk.windows-old": "Instalación anterior de Windows",
  "junk.package-cache": "Caché de paquetes de instalación",
  "junk.panther": "Registros de instalación",
  "junk.wer": "Informes de errores",
  "junk.patch-cache": "Caché de parches",
  "junk.dev-cache": "Caché de paquetes de desarrollo",

  "junk.why.win-temp": "Espacio de trabajo de programas de Windows mientras se ejecutan. Se recrea según se necesita; no contiene datos de usuario.",
  "junk.why.system-temp": "Zona de trabajo del sistema para servicios de Windows. Seguro de borrar; Windows la recrea.",
  "junk.why.user-temp": "Archivos temporales de los programas de esta cuenta. Se recrean según se necesitan; no contienen datos de usuario.",
  "junk.why.pkg-temp": "Estado temporal de apps de la Store mientras se ejecutan. La app lo recrea al iniciarse.",
  "junk.why.inetcache": "Caché web de Internet Explorer / del sistema. Se regenera al navegar.",
  "junk.why.thumbs": "Caché de miniaturas e iconos. Windows la reconstruye automáticamente.",
  "junk.why.browser-cache": "Caché de páginas/shaders GPU del navegador. Se regenera al navegar.",
  "junk.why.win-update-cache": "Parches de Windows descargados y ya instalados. Solo se descargan de nuevo si hacen falta.",
  "junk.why.delivery-opt": "Caché de descarga/intercambio de Optimización de entrega. Windows la gestiona y rellena.",
  "junk.why.recycle-bin": "Archivos ya eliminados, aún recuperables hasta vaciar la Papelera.",
  "junk.why.crash-dumps": "Volcados de fallos de kernel/aplicaciones (incl. MEMORY.DMP) para depuración. Windows escribe uno nuevo si vuelve a fallar.",
  "junk.why.win-logs": "Registros antiguos de Windows. Solo se usan para diagnóstico; se escriben nuevos continuamente.",
  "junk.why.servicing-cache": "Preparación temporal de actualizaciones de Windows/WinSxS. Windows la recrea.",
  "junk.why.os-cache": "Archivos de caché de componentes de Windows. El shell los regenera.",
  "junk.why.shader-cache": "Cachés de shaders GPU (DirectX/NVIDIA/AMD). Se reconstruyen al volver a ejecutar juegos/apps.",
  "junk.why.gpu-installer": "Paquetes/caché sobrantes de instaladores de controladores GPU. Seguro de borrar; los controladores ya están instalados.",
  "junk.why.prefetch": "Sugerencias Prefetch de inicio de apps. Borrarlas solo ralentiza los primeros inicios mientras se reconstruyen.",
  "junk.why.windows-old": "Instalación anterior de Windows conservada 10 días para revertir. Borrarla libera mucho espacio; ya no podrá revertir.",
  "junk.why.package-cache": "Paquetes de instalación para reparar/desinstalar. Borrarlos obliga a volver a descargar los instaladores grandes.",
  "junk.why.panther": "Registros de instalación de Windows. Para diagnosticar actualizaciones; seguro de borrar.",
  "junk.why.wer": "Informes de fallos del Informe de errores de Windows. Seguro de borrar; solo sirven para reportar errores.",
  "junk.why.patch-cache": "Parches de Windows en caché. Borrarlos obliga a descargarlos de nuevo para reparar/actualizar.",
  "junk.why.dev-cache": "Cachés de paquetes de desarrollo (npm/pip/Cargo/NuGet/Gradle/Maven/Go). Se descargan de nuevo en la próxima compilación.",

  "bucket.images": "Imágenes",
  "bucket.videos": "Vídeos",
  "bucket.audio": "Audio",
  "bucket.documents": "Documentos",
  "bucket.archives": "Archivos comprimidos",
  "bucket.executables": "Ejecutables",
  "bucket.code": "Código",
  "bucket.other": "Otros",

  "unit.file": "archivo",
  "unit.files": "archivos",
  "unit.copy": "copia",
  "unit.copies": "copias",
};

I18N.de = {
  "app.tagline": "Festplatten-Analyse",
  "app.sections": "Bereiche",
  "tab.explorer": "Explorer",
  "tab.clean": "Aufräumen",
  "tab.dupes": "Duplikate",
  "tab.stats": "Statistik",
  "header.elevated": "erhöht",

  "btn.help": "Hilfe",
  "btn.help.title": "Hilfe — wofür ist diese App?",
  "btn.settings": "Einstellungen",
  "btn.settings.title": "Einstellungen — Darstellung und Sprache",
  "btn.scan": "Scannen",
  "btn.cancel": "Abbrechen",
  "btn.close": "Schließen",
  "btn.about": "Über",
  "about.title": "Über Greater",
  "about.version": "Version 1.0",
  "about.developer": "Entwickler",
  "about.company": "Unternehmen",
  "about.email": "Kontakt",
  "about.desc": "Ein schneller, sicherer Speicherplatz-Analysator für Windows. Er scannt in Sekunden, findet Junk- und doppelte Dateien und zeigt genau, wohin der Speicher geht.",
  "about.copyHint": "Adresse anklicken, um sie zu kopieren",
  "welcome.title": "Willkommen bei Greater",
  "welcome.subtitle": "Wähle Sprache und Design. Beides lässt sich später in den Einstellungen ändern.",
  "welcome.start": "Greater starten",
  "toast.copied": "E-Mail-Adresse kopiert",
  "btn.dismiss": "Verwerfen",
  "btn.selectNone": "Nichts auswählen",
  "btn.selectAll": "Alle auswählen",
  "btn.toRecycle": "In den Papierkorb",
  "btn.deletePerm": "Endgültig löschen",
  "btn.loadMore": "Mehr laden",
  "btn.keepAll": "Alle behalten",
  "btn.selectAllDupes": "Alle Duplikate auswählen",
  "btn.openLocation": "Speicherort öffnen",
  "btn.moveTrash": "In den Papierkorb",
  "btn.ok": "Bestätigen",

  "explorer.pathPh": "Zu scannender Ordner, z. B. C:\\",
  "explorer.modeTitle": "Scan-Modus",
  "explorer.footer": "Engine: paralleler FindFirstFileExW-Walker · MFT-Schnellpfad geplant",
  "mode.fast": "schnell (parallel)",
  "mode.simple": "einfach (ein Thread)",
  "mode.portable": "portabel (parallel, read_dir)",
  "mode.baseline": "Referenz (read_dir)",
  "groupby.label": "Auflisten nach",
  "groupby.title": "Jede Datei auflisten oder nach Ordner zusammenfassen",
  "groupby.files": "Nach Datei",
  "groupby.folders": "Nach Ordner",
  "explorer.allFiles": "Alle Dateien",
  "explorer.allFolders": "Alle Ordner",
  "explorer.emptyFiles": "Noch kein Scan.",
  "explorer.emptyFolders": "Noch keine Ordner.",
  "list.filesLargest": "{n} Dateien (größte zuerst)",
  "list.filesLargestOf": "{shown} größte von {total} Dateien",
  "list.foldersLargest": "{n} Ordner (größte zuerst)",
  "list.foldersLargestOf": "{shown} größte von {total} Ordnern",
  "col.name": "Name",
  "col.size": "Größe",
  "col.files": "Dateien",

  "stat.elapsed": "Dauer",
  "stat.files": "Dateien",
  "stat.folders": "Ordner",
  "stat.size": "Größe",
  "stat.rate": "Rate",
  "stat.skipped": "übersprungen",
  "stat.none": "keine",
  "stat.scanned": "gescannt",
  "stat.junkFiles": "Ballastdateien",
  "stat.reclaimable": "freigebbar",
  "stat.selected": "ausgewählt",
  "stat.groups": "Gruppen",
  "stat.copies": "Kopien",
  "stat.totalSize": "Gesamtgröße",
  "stat.categories": "Kategorien",
  "stat.largestType": "größter Typ",
  "status.ready": "Bereit.",

  "drive.used": "belegt",
  "drive.free": "frei",
  "drive.total": "gesamt",
  "drive.internal": "intern",
  "drive.noDrives": "keine Laufwerke",
  "drive.tooltip": "{letter}: — {used} belegt, {free} frei von {total}",

  "clean.controls": "Laufwerkskarte überfahren, dann Aufräumen klicken.",
  "clean.controlsBusy": "Räume {path} auf…",
  "clean.idle": "Laufwerkskarte überfahren und Aufräumen klicken, um nach Ballast zu suchen.",
  "clean.title": "Zu löschende Dateien",
  "clean.all": "alle",
  "clean.safe": "sicher",
  "clean.optional": "optional",
  "clean.colFile": "Datei",
  "clean.colWhy": "warum Ballast",
  "clean.checkAllTitle": "Alle gelisteten auswählen",
  "clean.hintDefault": "Sichere Einträge sind standardmäßig angehakt.",
  "clean.emptyDefault": "Aufräumen starten, um Ballastdateien aufzulisten.",
  "clean.emptyNoMatch": "Hier nichts aufzuräumen — kein Ballast gefunden.",
  "clean.selectedNone": "keine",
  "clean.selected": "{count} Dateien · {size}",
  "clean.hintNothing": "Nichts aufzuräumen.",
  "clean.hintNone": "Nichts ausgewählt von {total} Ballastdateien.",
  "clean.hintSome": "{count} von {total} Ballastdateien ausgewählt · {size}.",
  "clean.scanning": "Suche Ballast in {path}…",
  "clean.scanningProgress": "scannen… {files} Dateien, {folders} Ordner",
  "clean.cancelling": "Abbruch — aktueller Ordner wird beendet…",
  "clean.cancelled": "Nach {secs} s abgebrochen — {files} Ballastdateien gefunden.",
  "clean.nothing": "Nichts auf {path} aufzuräumen — {files} Dateien in {secs} s gescannt.",
  "clean.found": "{files} Dateien zum Entfernen — {size} freigebbar ({safe} sicher · {optional} optional). {scanned} Dateien in {secs} s gescannt.",
  "clean.deleted": "Endgültig gelöscht",
  "clean.trashed": "In den Papierkorb verschoben",
  "clean.result": "{verb}: {deleted} Dateien, {size}.{failed}",
  "clean.failedNote": " {n} konnten nicht entfernt werden (in Benutzung oder Zugriff verweigert).",
  "clean.deleting": "Entferne {done} von {total} Dateien…",
  "status.deleting": "Lösche {name}…",
  "deleting.title": "Dateien werden entfernt…",
  "deleting.titleDone": "Fertig",
  "deleting.of": "von",
  "deleting.removedLabel": "entfernt",
  "deleting.current": "Lösche: {name}",
  "deleting.failed": "{n} konnten nicht entfernt werden (in Benutzung oder Zugriff verweigert).",
  "deleting.doneTrash": "{n} Dateien in den Papierkorb verschoben.",
  "deleting.donePerm": "{n} Dateien endgültig gelöscht.",
  "deleting.freed": "{size} bisher freigegeben",
  "deleting.stopping": "Stoppe…",
  "deleting.titleCancelled": "Abgebrochen",

  "dupes.controls": "Laufwerkskarte überfahren, dann Duplikate suchen klicken.",
  "dupes.controlsBusy": "Suche Duplikate auf {path}…",
  "dupes.idle": "Bereit. Mindestgröße wählen, dann ein Laufwerk starten.",
  "dupes.smallest": "kleinste Datei",
  "dupes.smallest.title": "Dateien unter dieser Größe ignorieren",
  "dupes.keep": "behalten",
  "dupes.keep.title": "Welche Kopie jeder Gruppe standardmäßig behalten wird",
  "dupes.keepOldest": "älteste Kopie",
  "dupes.keepNewest": "neueste Kopie",
  "dupes.keepShortest": "kürzester Pfad",
  "dupes.title": "Duplikatgruppen",
  "dupes.summary": "{groups} Gruppen · {files} Kopien · {wasted} freigebbar",
  "dupes.hintDefault": "Standardmäßig wird eine Kopie pro Gruppe behalten.",
  "dupes.hintEmpty": "Keine Kopien gelistet.",
  "dupes.hintNone": "Nichts ausgewählt — alle Kopien der {groups} Gruppen bleiben.",
  "dupes.hintSome": "{count} von {total} Kopien ausgewählt · {size}. Eine Kopie pro Gruppe bleibt immer.",
  "dupes.emptyList": "Keine Duplikate bei dieser Mindestgröße.",
  "dupes.groupMeta": "{n} Kopien · je {size} · {wasted} freigebbar",
  "dupes.tagDelete": "löschen",
  "dupes.tagKeep": "behalten",
  "dupes.pickTitle": "Anhaken, um diese Kopie zu löschen",
  "dupes.starTitle": "Nur diese Kopie behalten",
  "dupes.scanning": "Scanne {path}, lese dann Dateien mit gleicher Größe…",
  "dupes.hashing": "Duplikate prüfen… {files} Dateien gelesen",
  "dupes.scanningProgress": "scannen… {files} Dateien, {folders} Ordner",
  "dupes.cancel": "Abbruch — aktuelle Datei wird beendet…",
  "dupes.cancelled": "Nach {secs} s abgebrochen — {groups} Duplikatgruppen gefunden.",
  "dupes.none": "Keine Duplikate auf {path} bei dieser Mindestgröße — {files} Dateien in {secs} s gescannt.",
  "dupes.found": "{groups} Duplikatgruppen gefunden — {wasted} freigebbar bei {copies} Kopien. {files} Dateien in {secs} s gescannt.",
  "dupes.result": "{verb}: {deleted} Dateien, {size}. {groups} Gruppen übrig ({wasted} freigebbar).{failed}",

  "stats.controls": "Laufwerkskarte überfahren, dann Analysieren klicken.",
  "stats.controlsBusy": "Analysiere {path}…",
  "stats.title": "Statistik",
  "stats.subtitle": "Platz nach Dateityp — Laufwerk überfahren, Analysieren klicken",
  "stats.analyzing": "Analysiere {path} — scannen, dann nach Dateityp gruppieren…",
  "stats.cancelling": "Abbruch — aktueller Ordner wird beendet…",
  "stats.scanningProgress": "scannen… {files} Dateien, {folders} Ordner",
  "stats.noFiles": "keine Dateien",
  "stats.largest": "{name} · {size}",
  "stats.viewTotal": "{pct} % sind {name} · {size} gesamt",
  "stats.done": "{files} Dateien auf {path} in {secs} s analysiert — in {cats} Typen gruppiert ({size}).",
  "stats.cancelled": "Nach {secs} s abgebrochen — teilweise Auswertung ({cats} Typen, {size}).",
  "stats.chartTitle": "{name} — {size} ({pct} %)",
  "stats.rowTitleDisk": "{name} — {size} · {pct} % der {disk}-Platte",
  "stats.rowTitleScanned": "{name} — {size} · {pct} % der {scanned} gescannt",

  "modal.info.title": "Dateiinformationen",
  "modal.confirm.title": "Sind Sie sicher?",
  "modal.help.title": "Greater — Hilfe und Anleitung",
  "modal.settings.title": "Einstellungen",
  "settings.appearance": "Darstellung",
  "settings.themeNote": "System folgt der hell/dunkel-Einstellung von Windows.",
  "theme.dark": "Dunkel",
  "theme.light": "Hell",
  "theme.system": "System",
  "settings.language": "Sprache",
  "settings.langNote": "Die Oberfläche wird sofort aktualisiert, inklusive Hilfe.",
  "settings.theme": "Design",

  "info.size": "Größe",
  "info.pctLargest": "% der größten",
  "info.extension": "Erweiterung",
  "info.folder": "Ordner",
  "info.modified": "geändert",
  "info.created": "erstellt",
  "info.accessed": "zugegriffen",
  "info.bytes": "{n} Bytes",
  "info.readonly": "schreibgeschützt",
  "info.hidden": "versteckt",
  "info.system": "System",
  "info.archive": "Archiv",
  "info.reparse": "Reparse-Punkt",

  "row.moreInfo": "Mehr Infos",
  "row.openLocation": "Speicherort öffnen",
  "row.trash": "In den Papierkorb",
  "row.delete": "Endgültig löschen",

  "confirm.trashTitle": "In den Papierkorb verschieben?",
  "confirm.trashBody": "{name}\n\nSie können ihn später aus dem Papierkorb wiederherstellen.",
  "confirm.deleteTitle": "Endgültig löschen?",
  "confirm.deleteBody": "{name}\n\nDies umgeht den Papierkorb. Die Datei kann nicht wiederhergestellt werden.",
  "confirm.cleanBody": "{count} Dateien, {size}.\n\n{note}",
  "confirm.permNote": "Dies umgeht den Papierkorb und kann nicht rückgängig gemacht werden.",
  "confirm.cleanTrashNote": "Danach aus dem Papierkorb wiederherstellbar. Windows löscht Elemente, die zu groß für den Papierkorb sind, endgültig.",
  "confirm.dupBody": "{count} doppelte Kopien · {size}.\n\nEine Kopie pro Gruppe bleibt immer. {note}",
  "confirm.dupPermNote": "Dies umgeht den Papierkorb; die Dateien können nicht wiederhergestellt werden.",
  "confirm.dupTrashNote": "Dateien gehen in den Papierkorb. Sehr große können endgültig gelöscht werden.",

  "status.pickFolder": "Zuerst ein Laufwerk wählen oder einen Ordner eingeben.",
  "status.scanning": "Scanne {path}…",
  "status.cancelling": "Abbruch — aktueller Ordner wird beendet…",
  "status.error": "Fehler: {e}",
  "status.cancel": "Abbruch: {e}",
  "status.scanningProgress": "scannen… {files} Dateien, {folders} Ordner",
  "status.done": "Fertig in {secs} s — {files} Dateien, {size}.",
  "status.doneCancelled": "Nach {secs} s abgebrochen — {files} Dateien gefunden.",
  "status.cancelledTag": " (abgebrochen)",
  "status.volumeFail": "Laufwerksliste fehlgeschlagen: {e}",
  "status.listenProgressFail": "Fortschritts-Listener fehlgeschlagen: {e}",
  "status.listenDoneFail": "Ende-Listener fehlgeschlagen: {e}",
  "status.moved": "In den Papierkorb verschoben: {path}",
  "status.deleted": "Endgültig gelöscht: {path}",

  "toast.moved": "in den Papierkorb verschoben: {name}",
  "toast.deleted": "endgültig gelöscht: {name}",
  "toast.trashFail": "Papierkorb fehlgeschlagen: {e}",
  "toast.deleteFail": "Löschen fehlgeschlagen: {e}",
  "toast.opened": "Speicherort von {name} geöffnet",
  "toast.openFail": "Speicherort kann nicht geöffnet werden: {e}",
  "toast.infoFail": "Infos können nicht geöffnet werden: {e}",
  "toast.purged": "{verb}: {n} Dateien",
  "toast.cleanFail": "Aufräumen fehlgeschlagen: {e}",

  "junk.win-temp": "Windows-Temp",
  "junk.user-temp": "Temporäre Dateien",
  "junk.pkg-temp": "Temporärer App-Zustand",
  "junk.inetcache": "Internet-Cache",
  "junk.thumbs": "Miniaturansichten-Cache",
  "junk.browser-cache": "Browser-Cache",
  "junk.win-update-cache": "Windows-Update-Cache",
  "junk.delivery-opt": "Übermittlungsoptimierungs-Cache",
  "junk.recycle-bin": "Papierkorb",
  "junk.crash-dumps": "Absturzabbilder",
  "junk.win-logs": "Windows-Protokolle",
  "junk.system-temp": "System-Temp",
  "junk.shader-cache": "GPU-Shader-Cache",
  "junk.servicing-cache": "Wartungs-Cache",
  "junk.os-cache": "System-Cache",
  "junk.gpu-installer": "GPU-Installer-Reste",
  "junk.prefetch": "Prefetch-Daten",
  "junk.windows-old": "Vorherige Windows-Installation",
  "junk.package-cache": "Installer-Paket-Cache",
  "junk.panther": "Setup-Protokolle",
  "junk.wer": "Fehlerberichte",
  "junk.patch-cache": "Update-Patch-Cache",
  "junk.dev-cache": "Dev-Paket-Cache",

  "junk.why.win-temp": "Arbeitsbereich von Windows-Programmen während der Ausführung. Wird bei Bedarf neu erstellt; keine Benutzerdaten.",
  "junk.why.system-temp": "Systemweiter Arbeitsbereich für Windows-Dienste. Bedenkenlos löschbar; Windows erstellt ihn neu.",
  "junk.why.user-temp": "Temporäre Dateien der Programme dieses Kontos. Werden bei Bedarf neu erstellt; keine Benutzerdaten.",
  "junk.why.pkg-temp": "Temporärer Zustand von Store-Apps während der Ausführung. Wird beim nächsten Start neu erstellt.",
  "junk.why.inetcache": "Web-Cache von Internet Explorer / System. Wird beim Surfen neu erzeugt.",
  "junk.why.thumbs": "Miniaturansichten- und Symbol-Cache. Windows baut ihn automatisch neu auf.",
  "junk.why.browser-cache": "Seiten-/GPU-Shader-Cache des Browsers. Wird beim Surfen neu erzeugt.",
  "junk.why.win-update-cache": "Heruntergeladene, bereits installierte Windows-Updates. Werden nur bei Bedarf erneut geladen.",
  "junk.why.delivery-opt": "Download-/Peer-Cache der Übermittlungsoptimierung. Windows verwaltet und füllt ihn.",
  "junk.why.recycle-bin": "Bereits gelöschte Dateien, bis zum Leeren des Papierkorbs wiederherstellbar.",
  "junk.why.crash-dumps": "Kernel-/App-Absturzabbilder (inkl. MEMORY.DMP) zur Fehlersuche. Windows schreibt bei erneutem Absturz ein neues.",
  "junk.why.win-logs": "Alte Windows-Protokolle. Nur zur Fehlersuche nützlich; neue werden laufend geschrieben.",
  "junk.why.servicing-cache": "Temporäre Ablage für Windows-Wartung/WinSxS-Updates. Windows erstellt sie neu.",
  "junk.why.os-cache": "Cache-Dateien von Windows-Komponenten. Werden von der Shell neu erzeugt.",
  "junk.why.shader-cache": "GPU-Shader-Caches (DirectX/NVIDIA/AMD). Werden beim nächsten Start von Spielen/Apps neu aufgebaut.",
  "junk.why.gpu-installer": "Übrig gebliebene GPU-Treiber-Installer/Pakete. Bedenkenlos entfernbar; Treiber sind bereits installiert.",
  "junk.why.prefetch": "Prefetch-Hinweise zum App-Start. Löschen verlangsamt nur die ersten Starts, bis sie neu aufgebaut sind.",
  "junk.why.windows-old": "Vorherige Windows-Installation, 10 Tage für Rollback behalten. Löschen schafft viel Platz; Rollback ist dann nicht mehr möglich.",
  "junk.why.package-cache": "Installer-Pakete für Reparatur/Deinstallation. Löschen erzwingt erneutes Herunterladen großer Installer.",
  "junk.why.panther": "Windows-Setup-Protokolle. Zur Fehlersuche bei Upgrades; bedenkenlos löschbar.",
  "junk.why.wer": "Absturzberichte der Windows-Fehlerberichterstattung. Bedenkenlos löschbar; dienen nur der Fehlermeldung.",
  "junk.why.patch-cache": "Zwischengespeicherte Windows-Patches. Löschen erzwingt erneutes Herunterladen für Reparatur/Updates.",
  "junk.why.dev-cache": "Entwickler-Paket-Caches (npm/pip/Cargo/NuGet/Gradle/Maven/Go). Werden beim nächsten Build erneut geladen.",

  "bucket.images": "Bilder",
  "bucket.videos": "Videos",
  "bucket.audio": "Audio",
  "bucket.documents": "Dokumente",
  "bucket.archives": "Archive",
  "bucket.executables": "Programme",
  "bucket.code": "Code",
  "bucket.other": "Sonstiges",

  "unit.file": "Datei",
  "unit.files": "Dateien",
  "unit.copy": "Kopie",
  "unit.copies": "Kopien",
};

I18N.ar = {
  "app.tagline": "محلّل مساحة القرص",
  "app.sections": "الأقسام",
  "tab.explorer": "المستكشف",
  "tab.clean": "التنظيف",
  "tab.dupes": "المكرّرات",
  "tab.stats": "الإحصاءات",
  "header.elevated": "بصلاحيات مرتفعة",

  "btn.help": "مساعدة",
  "btn.help.title": "مساعدة — ما وظيفة هذا التطبيق؟",
  "btn.settings": "الإعدادات",
  "btn.settings.title": "الإعدادات — المظهر واللغة",
  "btn.scan": "فحص",
  "btn.cancel": "إلغاء",
  "btn.close": "إغلاق",
  "btn.about": "حول",
  "about.title": "حول Greater",
  "about.version": "الإصدار 1.0",
  "about.developer": "المطوّر",
  "about.company": "الشركة",
  "about.email": "التواصل",
  "about.desc": "محلّل سريع وآمن لاستخدام مساحة القرص في Windows. يفحص في ثوانٍ، ويكشف الملفات غير الضرورية والمكرّرة، ويوضّح بدقة أين تذهب مساحتك.",
  "about.copyHint": "انقر على العنوان لنسخه",
  "welcome.title": "مرحبًا بك في Greater",
  "welcome.subtitle": "اختر لغتك ومظهرك. يمكنك تغيير كليهما لاحقًا من الإعدادات.",
  "welcome.start": "ابدأ استخدام Greater",
  "toast.copied": "تم نسخ عنوان البريد",
  "btn.dismiss": "تجاهل",
  "btn.selectNone": "إلغاء تحديد الكل",
  "btn.selectAll": "تحديد الكل",
  "btn.toRecycle": "نقل إلى سلة المحذوفات",
  "btn.deletePerm": "حذف نهائي",
  "btn.loadMore": "تحميل المزيد",
  "btn.keepAll": "الاحتفاظ بالكل",
  "btn.selectAllDupes": "تحديد كل المكرّرات",
  "btn.openLocation": "فتح الموقع",
  "btn.moveTrash": "نقل إلى السلة",
  "btn.ok": "تأكيد",

  "explorer.pathPh": "المجلد المراد فحصه، مثل C:\\",
  "explorer.modeTitle": "وضع الفحص",
  "explorer.footer": "المحرّك: مُمشّي FindFirstFileExW المتوازي · مسار MFT السريع مخطط له",
  "mode.fast": "سريع (متوازٍ)",
  "mode.simple": "بسيط (خيط واحد)",
  "mode.portable": "محمول (متوازٍ، read_dir)",
  "mode.baseline": "مرجعي (read_dir)",
  "groupby.label": "العرض حسب",
  "groupby.title": "عرض كل ملف، أو تجميعها حسب المجلد",
  "groupby.files": "حسب الملف",
  "groupby.folders": "حسب المجلد",
  "explorer.allFiles": "كل الملفات",
  "explorer.allFolders": "كل المجلدات",
  "explorer.emptyFiles": "لا يوجد فحص بعد.",
  "explorer.emptyFolders": "لا توجد مجلدات بعد.",
  "list.filesLargest": "{n} ملفًا (الأكبر أولًا)",
  "list.filesLargestOf": "{shown} الأكبر من {total} ملفًا",
  "list.foldersLargest": "{n} مجلدًا (الأكبر أولًا)",
  "list.foldersLargestOf": "{shown} الأكبر من {total} مجلدًا",
  "col.name": "الاسم",
  "col.size": "الحجم",
  "col.files": "الملفات",

  "stat.elapsed": "المدة",
  "stat.files": "الملفات",
  "stat.folders": "المجلدات",
  "stat.size": "الحجم",
  "stat.rate": "السرعة",
  "stat.skipped": "تم تجاوزها",
  "stat.none": "لا شيء",
  "stat.scanned": "تم فحصها",
  "stat.junkFiles": "ملفات غير ضرورية",
  "stat.reclaimable": "قابل للاستعادة",
  "stat.selected": "المحدد",
  "stat.groups": "المجموعات",
  "stat.copies": "النسخ",
  "stat.totalSize": "الحجم الكلي",
  "stat.categories": "الفئات",
  "stat.largestType": "أكبر نوع",
  "status.ready": "جاهز.",

  "drive.used": "مستخدم",
  "drive.free": "متاح",
  "drive.total": "الإجمالي",
  "drive.internal": "داخلي",
  "drive.noDrives": "لا توجد أقراص",
  "drive.tooltip": "{letter}: — {used} مستخدم، {free} متاح من {total}",

  "clean.controls": "مرّر فوق بطاقة قرص ثم اضغط تنظيف.",
  "clean.controlsBusy": "جارٍ تنظيف {path}…",
  "clean.idle": "مرّر فوق بطاقة قرص واضغط تنظيف للبحث عن الملفات غير الضرورية.",
  "clean.title": "الملفات المراد حذفها",
  "clean.all": "الكل",
  "clean.safe": "آمنة",
  "clean.optional": "اختيارية",
  "clean.colFile": "الملف",
  "clean.colWhy": "سبب اعتباره غير ضروري",
  "clean.checkAllTitle": "تحديد كل ما هو مدرج",
  "clean.hintDefault": "العناصر الآمنة محددة افتراضيًا.",
  "clean.emptyDefault": "ابدأ عملية تنظيف لإدراج الملفات غير الضرورية.",
  "clean.emptyNoMatch": "لا شيء لتنظيفه هنا — لم يُعثر على ملفات غير ضرورية.",
  "clean.selectedNone": "لا شيء",
  "clean.selected": "{count} ملفًا · {size}",
  "clean.hintNothing": "لا شيء لتنظيفه.",
  "clean.hintNone": "لم يتم تحديد شيء من {total} ملفًا غير ضروري.",
  "clean.hintSome": "تم تحديد {count} من {total} ملفًا غير ضروري · {size}.",
  "clean.scanning": "جارٍ البحث عن ملفات غير ضرورية في {path}…",
  "clean.scanningProgress": "جارٍ الفحص… {files} ملفًا، {folders} مجلدًا",
  "clean.cancelling": "جارٍ الإلغاء — إنهاء المجلد الحالي…",
  "clean.cancelled": "أُلغي بعد {secs} ثانية — عُثر على {files} ملفًا غير ضروري.",
  "clean.nothing": "لا شيء لتنظيفه في {path} — تم فحص {files} ملفًا في {secs} ثانية.",
  "clean.found": "عُثر على {files} ملفًا للإزالة — {size} قابلة للاستعادة ({safe} آمنة · {optional} اختيارية). تم فحص {scanned} ملفًا في {secs} ثانية.",
  "clean.deleted": "تم الحذف نهائيًا",
  "clean.trashed": "تم النقل إلى سلة المحذوفات",
  "clean.result": "{verb}: {deleted} ملفًا، {size}.{failed}",
  "clean.failedNote": " تعذّرت إزالة {n} (قيد الاستخدام أو تم رفض الوصول).",
  "clean.deleting": "جارٍ إزالة {done} من {total} ملفًا…",
  "status.deleting": "جارٍ حذف {name}…",
  "deleting.title": "جارٍ إزالة الملفات…",
  "deleting.titleDone": "تم",
  "deleting.of": "من",
  "deleting.removedLabel": "تمت إزالتها",
  "deleting.current": "جارٍ حذف: {name}",
  "deleting.failed": "تعذّرت إزالة {n} (قيد الاستخدام أو تم رفض الوصول).",
  "deleting.doneTrash": "تم نقل {n} ملفًا إلى سلة المحذوفات.",
  "deleting.donePerm": "تم حذف {n} ملفًا نهائيًا.",
  "deleting.freed": "تم تحرير {size} حتى الآن",
  "deleting.stopping": "جارٍ الإيقاف…",
  "deleting.titleCancelled": "أُلغيت",

  "dupes.controls": "مرّر فوق بطاقة قرص ثم اضغط البحث عن المكرّرات.",
  "dupes.controlsBusy": "جارٍ البحث عن المكرّرات في {path}…",
  "dupes.idle": "جاهز. حدّد حدًّا أدنى للحجم ثم شغّل قرصًا.",
  "dupes.smallest": "أصغر ملف",
  "dupes.smallest.title": "تجاهل الملفات الأصغر من هذا الحجم",
  "dupes.keep": "الاحتفاظ",
  "dupes.keep.title": "أي نسخة من كل مجموعة يتم الاحتفاظ بها افتراضيًا",
  "dupes.keepOldest": "أقدم نسخة",
  "dupes.keepNewest": "أحدث نسخة",
  "dupes.keepShortest": "أقصر مسار",
  "dupes.title": "مجموعات المكرّرات",
  "dupes.summary": "{groups} مجموعات · {files} نسخة · {wasted} قابلة للاستعادة",
  "dupes.hintDefault": "يُحتفظ بنسخة واحدة من كل مجموعة افتراضيًا.",
  "dupes.hintEmpty": "لا توجد نسخ مدرجة.",
  "dupes.hintNone": "لم يتم تحديد شيء — يتم الاحتفاظ بكل نسخ {groups} مجموعة.",
  "dupes.hintSome": "تم تحديد {count} من {total} نسخة · {size}. تُحفظ دائمًا نسخة واحدة من كل مجموعة.",
  "dupes.emptyList": "لا مكرّرات عند هذا الحد الأدنى للحجم.",
  "dupes.groupMeta": "{n} نسخة · {size} لكل منها · {wasted} قابلة للاستعادة",
  "dupes.tagDelete": "حذف",
  "dupes.tagKeep": "احتفاظ",
  "dupes.pickTitle": "حدّد لحذف هذه النسخة",
  "dupes.starTitle": "الاحتفاظ بهذه النسخة فقط",
  "dupes.scanning": "جارٍ فحص {path}، ثم قراءة الملفات ذات الحجم المشترك…",
  "dupes.hashing": "جارٍ التحقق من المكرّرات… تمت قراءة {files} ملفًا",
  "dupes.scanningProgress": "جارٍ الفحص… {files} ملفًا، {folders} مجلدًا",
  "dupes.cancel": "جارٍ الإلغاء — إنهاء الملف الحالي…",
  "dupes.cancelled": "أُلغي بعد {secs} ثانية — عُثر على {groups} مجموعة مكرّرة.",
  "dupes.none": "لا مكرّرات في {path} عند هذا الحد الأدنى — تم فحص {files} ملفًا في {secs} ثانية.",
  "dupes.found": "عُثر على {groups} مجموعة مكرّرة — {wasted} قابلة للاستعادة عبر {copies} نسخة. تم فحص {files} ملفًا في {secs} ثانية.",
  "dupes.result": "{verb}: {deleted} ملفًا، {size}. تبقّت {groups} مجموعات ({wasted} قابلة للاستعادة).{failed}",

  "stats.controls": "مرّر فوق بطاقة قرص ثم اضغط تحليل.",
  "stats.controlsBusy": "جارٍ تحليل {path}…",
  "stats.title": "الإحصاءات",
  "stats.subtitle": "المساحة حسب نوع الملف — مرّر فوق قرص واضغط تحليل",
  "stats.analyzing": "جارٍ تحليل {path} — فحص ثم تجميع حسب نوع الملف…",
  "stats.cancelling": "جارٍ الإلغاء — إنهاء المجلد الحالي…",
  "stats.scanningProgress": "جارٍ الفحص… {files} ملفًا، {folders} مجلدًا",
  "stats.noFiles": "لا ملفات",
  "stats.largest": "{name} · {size}",
  "stats.viewTotal": "{pct}% هي {name} · {size} إجمالًا",
  "stats.done": "تم تحليل {files} ملفًا في {path} خلال {secs} ثانية — موزّعة على {cats} أنواع ({size}).",
  "stats.cancelled": "أُلغي بعد {secs} ثانية — تحليل جزئي ({cats} أنواع، {size}).",
  "stats.chartTitle": "{name} — {size} ({pct}%)",
  "stats.rowTitleDisk": "{name} — {size} · {pct}% من القرص {disk}",
  "stats.rowTitleScanned": "{name} — {size} · {pct}% من {scanned} المفحوصة",

  "modal.info.title": "معلومات الملف",
  "modal.confirm.title": "هل أنت متأكد؟",
  "modal.help.title": "Greater — المساعدة ودليل الاستخدام",
  "modal.settings.title": "الإعدادات",
  "settings.appearance": "المظهر",
  "settings.themeNote": "يتبع «النظام» إعداد الوضع الفاتح/الداكن في Windows.",
  "theme.dark": "داكن",
  "theme.light": "فاتح",
  "theme.system": "النظام",
  "settings.language": "اللغة",
  "settings.langNote": "تتحدّث الواجهة فورًا، بما في ذلك المساعدة.",
  "settings.theme": "المظهر",

  "info.size": "الحجم",
  "info.pctLargest": "% من الأكبر",
  "info.extension": "الامتداد",
  "info.folder": "المجلد",
  "info.modified": "آخر تعديل",
  "info.created": "الإنشاء",
  "info.accessed": "آخر وصول",
  "info.bytes": "{n} بايت",
  "info.readonly": "للقراءة فقط",
  "info.hidden": "مخفي",
  "info.system": "نظام",
  "info.archive": "أرشيف",
  "info.reparse": "نقطة إعادة تحليل",

  "row.moreInfo": "مزيد من المعلومات",
  "row.openLocation": "فتح الموقع",
  "row.trash": "نقل إلى السلة",
  "row.delete": "حذف نهائي",

  "confirm.trashTitle": "النقل إلى سلة المحذوفات؟",
  "confirm.trashBody": "{name}\n\nيمكنك استعادته من سلة المحذوفات لاحقًا.",
  "confirm.deleteTitle": "حذف نهائي؟",
  "confirm.deleteBody": "{name}\n\nسيتجاوز هذا سلة المحذوفات. لا يمكن استعادة الملف.",
  "confirm.cleanBody": "{count} ملفًا، {size}.\n\n{note}",
  "confirm.permNote": "يتجاوز هذا سلة المحذوفات ولا يمكن التراجع عنه.",
  "confirm.cleanTrashNote": "يمكن استعادتها من سلة المحذوفات لاحقًا. يحذف Windows نهائيًا العناصر الأكبر من سعة السلة.",
  "confirm.dupBody": "{count} نسخة مكرّرة · {size}.\n\nتُحفظ دائمًا نسخة واحدة من كل مجموعة. {note}",
  "confirm.dupPermNote": "يتجاوز هذا سلة المحذوفات؛ لا يمكن استعادة الملفات.",
  "confirm.dupTrashNote": "تنتقل الملفات إلى سلة المحذوفات. قد تُحذف الملفات الكبيرة جدًا نهائيًا.",

  "status.pickFolder": "اختر قرصًا أو اكتب مجلدًا أولًا.",
  "status.scanning": "جارٍ فحص {path}…",
  "status.cancelling": "جارٍ الإلغاء — إنهاء المجلد الحالي…",
  "status.error": "خطأ: {e}",
  "status.cancel": "إلغاء: {e}",
  "status.scanningProgress": "جارٍ الفحص… {files} ملفًا، {folders} مجلدًا",
  "status.done": "اكتمل في {secs} ثانية — {files} ملفًا، {size}.",
  "status.doneCancelled": "أُلغي بعد {secs} ثانية — عُثر على {files} ملفًا.",
  "status.cancelledTag": " (ملغى)",
  "status.volumeFail": "فشل إدراج الأقراص: {e}",
  "status.listenProgressFail": "فشل الاستماع للتقدّم: {e}",
  "status.listenDoneFail": "فشل الاستماع للانتهاء: {e}",
  "status.moved": "نُقل إلى سلة المحذوفات: {path}",
  "status.deleted": "حُذف نهائيًا: {path}",

  "toast.moved": "نُقل إلى سلة المحذوفات: {name}",
  "toast.deleted": "حُذف نهائيًا: {name}",
  "toast.trashFail": "فشل النقل إلى السلة: {e}",
  "toast.deleteFail": "فشل الحذف: {e}",
  "toast.opened": "تم فتح موقع {name}",
  "toast.openFail": "تعذّر فتح الموقع: {e}",
  "toast.infoFail": "تعذّر فتح المعلومات: {e}",
  "toast.purged": "{verb}: {n} ملفًا",
  "toast.cleanFail": "فشل التنظيف: {e}",

  "junk.win-temp": "Temp في Windows",
  "junk.user-temp": "ملفات مؤقتة",
  "junk.pkg-temp": "حالة مؤقتة للتطبيقات",
  "junk.inetcache": "ذاكرة الإنترنت المؤقتة",
  "junk.thumbs": "ذاكرة الصور المصغّرة",
  "junk.browser-cache": "ذاكرة المتصفح",
  "junk.win-update-cache": "ذاكرة Windows Update",
  "junk.delivery-opt": "ذاكرة تحسين التوصيل",
  "junk.recycle-bin": "سلة المحذوفات",
  "junk.crash-dumps": "تفريغات الأعطال",
  "junk.win-logs": "سجلات Windows",
  "junk.system-temp": "Temp النظام",
  "junk.shader-cache": "ذاكرة شيدر GPU",
  "junk.servicing-cache": "ذاكرة الصيانة",
  "junk.os-cache": "ذاكرة النظام",
  "junk.gpu-installer": "بقايا مثبّتات GPU",
  "junk.prefetch": "بيانات Prefetch",
  "junk.windows-old": "تثبيت Windows السابق",
  "junk.package-cache": "ذاكرة حزم التثبيت",
  "junk.panther": "سجلات الإعداد",
  "junk.wer": "تقارير الأعطال",
  "junk.patch-cache": "ذاكرة تحديثات التصحيح",
  "junk.dev-cache": "ذاكرة حزم التطوير",

  "junk.why.win-temp": "مساحة عمل تستخدمها برامج Windows أثناء التشغيل. تُعاد إنشاؤها عند الحاجة؛ لا تحتوي بيانات مستخدم.",
  "junk.why.system-temp": "مساحة عمل على مستوى النظام لخدمات Windows. آمنة للحذف؛ يعيد Windows إنشاءها.",
  "junk.why.user-temp": "ملفات مؤقتة لبرامج هذا الحساب. تُعاد إنشاؤها عند الحاجة؛ لا تحتوي بيانات مستخدم.",
  "junk.why.pkg-temp": "حالة مؤقتة لتطبيقات المتجر أثناء التشغيل. يعيد التطبيق إنشاءها عند التشغيل التالي.",
  "junk.why.inetcache": "ذاكرة ويب لـ Internet Explorer/النظام. تُعاد إنشاؤها بالتصفح.",
  "junk.why.thumbs": "ذاكرة الصور المصغّرة والأيقونات. يعيد Windows بنائها تلقائيًا.",
  "junk.why.browser-cache": "ذاكرة صفحات/شيدر GPU للمتصفح. تُعاد إنشاؤها بالتصفح.",
  "junk.why.win-update-cache": "تحديثات Windows التي نُزّلت وثُبّتت بالفعل. تُنزّل مجددًا عند الحاجة فقط.",
  "junk.why.delivery-opt": "ذاكرة تنزيل/مشاركة تحسين التوصيل. يديرها Windows ويعيد ملأها.",
  "junk.why.recycle-bin": "ملفات حذفتها بالفعل، ويمكن استعادتها حتى تفريغ السلة.",
  "junk.why.crash-dumps": "تفريغات أعطال النواة/التطبيقات (بما فيها MEMORY.DMP) لأغراض التصحيح. يكتب Windows غيرها عند تكرار العطل.",
  "junk.why.win-logs": "سجلات Windows قديمة. تُستخدم للاستكشاف فقط؛ تُكتب سجلات جديدة باستمرار.",
  "junk.why.servicing-cache": "منطقة تجهيز مؤقتة لتحديثات Windows/WinSxS. يعيد Windows إنشاءها.",
  "junk.why.os-cache": "ملفات ذاكرة مكوّنات Windows. يعيد الصدفة إنشاءها.",
  "junk.why.shader-cache": "ذاكرات شيدر GPU (DirectX/NVIDIA/AMD). تُعاد بناؤها عند تشغيل الألعاب/التطبيقات مجددًا.",
  "junk.why.gpu-installer": "حزم/ذاكرة مثبّتات تعريفات GPU متبقية. آمنة للإزالة؛ التعريفات مثبّتة بالفعل.",
  "junk.why.prefetch": "تلميحات Prefetch لبدء التطبيقات. حذفها يبطئ أول عمليات تشغيل فقط حتى تُعاد بناؤها.",
  "junk.why.windows-old": "تثبيت Windows سابق محفوظ 10 أيام للتراجع. حذفه يوفّر مساحة كبيرة؛ لن تتمكن من التراجع بعدها.",
  "junk.why.package-cache": "حزم تثبيت للإصلاح/إلغاء التثبيت. حذفها يعني إعادة تنزيل المثبّتات الكبيرة.",
  "junk.why.panther": "سجلات إعداد Windows. لاستكشاف مشكلات الترقية؛ آمنة للحذف.",
  "junk.why.wer": "تقارير أعطال «تقارير أخطاء Windows». آمنة للحذف؛ تُستخدم فقط للإبلاغ عن الأخطاء.",
  "junk.why.patch-cache": "تصحيحات Windows المخزّنة. حذفها يعني إعادة تنزيلها للإصلاح/التحديث.",
  "junk.why.dev-cache": "ذاكرات حزم المطوّرين (npm/pip/Cargo/NuGet/Gradle/Maven/Go). تُنزّل مجددًا عند البناء التالي.",

  "bucket.images": "صور",
  "bucket.videos": "فيديو",
  "bucket.audio": "صوت",
  "bucket.documents": "مستندات",
  "bucket.archives": "أرشيفات",
  "bucket.executables": "برامج تنفيذية",
  "bucket.code": "شيفرة",
  "bucket.other": "أخرى",

  "unit.file": "ملف",
  "unit.files": "ملفات",
  "unit.copy": "نسخة",
  "unit.copies": "نسخ",
};

const HELP = {};

HELP.en = [
  {
    h: "What is Greater?",
    b: [
      `<p>Greater is a <strong>disk-usage analyzer for Windows</strong>. It scans your drives fast, shows you exactly what is taking up space, and gives you safe tools to reclaim it — find junk files, locate duplicate copies, and see a breakdown of your data by file type.</p>`,
      `<p>It runs entirely on your PC. Nothing is uploaded anywhere. It does not require administrator rights for normal use; elevation is only ever needed to reach locked system areas (a badge in the top-right shows when it is elevated).</p>`
    ]
  },
  {
    h: "The four tabs",
    b: [
      `<p>The app is split into four sections, reachable from the tab bar under the header:</p>`,
      `<ul>
        <li><strong>Explorer</strong> — scan a folder or drive and browse every file, largest first. This is the main "what is eating my space" view.</li>
        <li><strong>Clean</strong> — scan for known junk (temporary files, caches, update leftovers) and delete it to reclaim space.</li>
        <li><strong>Duplicates</strong> — scan for byte-identical files and delete all but one copy of each group.</li>
        <li><strong>Statistics</strong> — scan a drive and see how its space is split by file type (images, videos, audio, documents, archives, executables, code, other).</li>
      </ul>`
    ]
  },
  {
    h: "Getting started (Explorer)",
    b: [
      `<ol>
        <li>Hover a <strong>drive card</strong> at the top and click its overlay button, or type a path (e.g. <code>D:\\Games</code>) in the path box.</li>
        <li>Press <strong>Scan</strong>. A progress bar and live counts appear while it walks the tree.</li>
        <li>When it finishes, the list shows files <strong>largest first</strong> with a size bar for each. Use <strong>Load more</strong> to page through, or switch <strong>List by</strong> to <em>By folder</em> to roll every folder up into one row.</li>
        <li>Hover any row for per-file actions: <em>info</em>, <em>open location</em>, <em>move to Recycle Bin</em>, <em>delete permanently</em>.</li>
      </ol>`,
      `<p>The six tiles above the list summarize the scan: files found, total size, elapsed time, the largest file, the average file size, and the deepest path.</p>`
    ]
  },
  {
    h: "Scanner modes (the dropdown next to the path)",
    b: [
      `<ul>
        <li><strong>fast (parallel)</strong> — recommended. Uses the native Windows fast-find API across many threads. Typical full C: scan: a few seconds.</li>
        <li><strong>simple (single thread)</strong> — same API but one thread; slower, useful to compare.</li>
        <li><strong>portable / baseline</strong> — generic directory-read fallback that works on any filesystem; slower. Use if the fast modes miss something.</li>
      </ul>`,
      `<p><strong>Reparse points</strong> (symlinks, junctions, mount points) are never followed or counted, so a scan cannot loop or double-count through them.</p>`
    ]
  },
  {
    h: "Clean tab — reclaiming space",
    b: [
      `<p>Clean scans for <em>junk</em>: files Windows and apps regenerate anyway (temp folders, caches, update leftovers, logs, thumbnails). Files are grouped into two categories:</p>`,
      `<ul>
        <li><strong>safe</strong> — no user data; regenerable scratch. Preselected.</li>
        <li><strong>optional</strong> — reversible, but costs a re-download or rebuild (e.g. a game shader cache). Opt in if you want the extra space.</li>
      </ul>`,
      `<p>Each row shows a reason badge explaining <em>why</em> it is junk. Then:</p>`,
      `<ol>
        <li>Use the filter chips (<em>all / safe / optional</em>) and select all/none to choose what to remove.</li>
        <li>Watch the live "selected" total (count + size) update as you tick.</li>
        <li>Click <strong>Move to Recycle Bin</strong> (reversible) or <strong>Delete permanently</strong>. A confirmation warns you first.</li>
      </ol>`,
      `<p class="help-note">Very large files cannot fit in the Recycle Bin and are removed permanently even when you choose "Recycle Bin" — the confirmation dialog reminds you of this.</p>`,
      `<p class="help-note">Files that are in use, or owned by the system without elevation, are skipped and reported as "still present (in use or access denied)".</p>`
    ]
  },
  {
    h: "Duplicates tab — removing duplicate copies",
    b: [
      `<ol>
        <li>Hover a drive card and click <strong>Find duplicates</strong>.</li>
        <li>Set a <strong>smallest file</strong> floor (default 1 MB) so tiny files are ignored, and pick a <strong>keep</strong> heuristic: <em>oldest</em>, <em>newest</em>, or <em>shortest path</em>.</li>
        <li>Only files whose <em>size is shared with another file</em> are content-hashed, so the scan is fast. Groups are sorted by how much space deleting the extras would free.</li>
        <li>Each group lists every copy. The <strong>star</strong> marks the copy that will be kept — click a different copy to keep that one instead.</li>
        <li>Click <strong>Move to Recycle Bin</strong> or <strong>Delete permanently</strong>. Exactly one copy per group is always kept; the last copy can never be deleted.</li>
      </ol>`,
      `<p class="help-note">Files are compared by content, not by name or timestamp — differently-named or differently-dated files with identical bytes are still detected as duplicates.</p>`
    ]
  },
  {
    h: "Statistics tab — space by file type",
    b: [
      `<ol>
        <li>Hover a drive card and click <strong>Analyze</strong>.</li>
        <li>When it finishes, files are bucketed by extension into: Images, Videos, Audio, Documents, Archives, Executables, Code, and Other.</li>
        <li>A stacked bar shows each category's share, and a legend lists every category with its size, a mini bar, the percentage, and the file count.</li>
      </ol>`,
      `<p>The mini bars are filled relative to the <strong>whole disk's capacity</strong>, so you can see how much of the drive each type occupies. Hover a row for exact numbers.</p>`
    ]
  },
  {
    h: "Understanding the numbers",
    b: [
      `<ul>
        <li><strong>scanned / files</strong> — how many files were found.</li>
        <li><strong>total size</strong> — combined size of everything found.</li>
        <li><strong>elapsed</strong> — how long the scan took.</li>
        <li><strong>size bar</strong> — the green bar on each row shows a file's size relative to the biggest file in the list, so outliers stand out.</li>
        <li><strong>reclaimable</strong> — space you would free by deleting the current selection.</li>
      </ul>`
    ]
  },
  {
    h: "Safety & privacy",
    b: [
      `<ul>
        <li>Nothing leaves your machine — no telemetry, no network calls.</li>
        <li>Deleting can go to the <strong>Recycle Bin</strong> (recoverable) or be <strong>permanent</strong>. When in doubt, use the Recycle Bin.</li>
        <li>Protected system files (pagefile, hiberfil, boot configuration, System Volume Information) are never touched.</li>
        <li>Every destructive action asks for confirmation first, and bulk deletes show exactly what will be removed.</li>
      </ul>`
    ]
  },
  {
    h: "Tips",
    b: [
      `<ul>
        <li>Scans are cancellable at any time — the partial results stay on screen.</li>
        <li>Only the file list scrolls; the controls stay in place as you resize the window.</li>
        <li>Live-churn differences of a fraction of a percent between scans are normal — files change while Windows runs.</li>
        <li>For a huge drive, start with Statistics to see the big picture, then Clean and Duplicates.</li>
      </ul>`
    ]
  },
  {
    h: "Glossary",
    b: [
      `<dl class="help-glossary">
        <dt>junk</dt><dd>Regenerable files (temp, caches, logs) that can be deleted to free space.</dd>
        <dt>reparse point</dt><dd>A symlink/junction/mount point. Greater never follows these.</dd>
        <dt>hardlink</dt><dd>Two names pointing at one file on disk. Counted once, never treated as duplicates.</dd>
        <dt>reclaimable</dt><dd>Space that would be freed if the currently selected items are deleted.</dd>
        <dt>elevated</dt><dd>Running with administrator rights, needed only to reach locked system files.</dd>
      </dl>`
    ]
  }
];

HELP.fr = [
  {
    h: "Qu'est-ce que Greater ?",
    b: [
      `<p>Greater est un <strong>analyseur d'espace disque pour Windows</strong>. Il analyse vos lecteurs rapidement, montre précisément ce qui occupe l'espace et fournit des outils sûrs pour le récupérer — trouver les fichiers inutiles, repérer les copies en double et afficher une répartition par type de fichier.</p>`,
      `<p>Tout s'exécute sur votre PC. Rien n'est envoyé nulle part. Aucun droit administrateur n'est nécessaire pour l'usage normal ; l'élévation ne sert qu'à atteindre des zones système verrouillées (un badge en haut à droite l'indique).</p>`
    ]
  },
  {
    h: "Les quatre onglets",
    b: [
      `<p>L'application est divisée en quatre sections, accessibles depuis la barre d'onglets sous l'en-tête :</p>`,
      `<ul>
        <li><strong>Explorateur</strong> — analysez un dossier ou un lecteur et parcourez tous les fichiers, du plus gros au plus petit. C'est la vue principale pour savoir « qu'est-ce qui remplit mon disque ».</li>
        <li><strong>Nettoyage</strong> — recherchez les fichiers inutiles connus (temporaires, caches, restes de mises à jour) et supprimez-les pour libérer de l'espace.</li>
        <li><strong>Doublons</strong> — recherchez les fichiers identiques octet pour octet et supprimez toutes les copies sauf une par groupe.</li>
        <li><strong>Statistiques</strong> — analysez un lecteur et voyez la répartition de l'espace par type de fichier (images, vidéos, audio, documents, archives, exécutables, code, autres).</li>
      </ul>`
    ]
  },
  {
    h: "Premiers pas (Explorateur)",
    b: [
      `<ol>
        <li>Survolez une <strong>carte de lecteur</strong> en haut et cliquez sur son bouton, ou saisissez un chemin (ex. <code>D:\\Jeux</code>) dans le champ.</li>
        <li>Cliquez sur <strong>Analyser</strong>. Une barre de progression et des compteurs en direct apparaissent pendant le parcours.</li>
        <li>À la fin, la liste affiche les fichiers <strong>du plus gros au plus petit</strong> avec une barre de taille. Utilisez <strong>Charger plus</strong> pour paginer, ou passez <strong>Lister par</strong> à <em>Par dossier</em> pour regrouper chaque dossier en une ligne.</li>
        <li>Survolez une ligne pour les actions : <em>infos</em>, <em>ouvrir l'emplacement</em>, <em>mettre à la corbeille</em>, <em>supprimer définitivement</em>.</li>
      </ol>`,
      `<p>Les six tuiles au-dessus de la liste résument l'analyse : fichiers trouvés, taille totale, durée, plus gros fichier, taille moyenne et chemin le plus profond.</p>`
    ]
  },
  {
    h: "Modes d'analyse (liste à côté du chemin)",
    b: [
      `<ul>
        <li><strong>rapide (parallèle)</strong> — recommandé. Utilise l'API native de recherche rapide de Windows sur plusieurs threads. Analyse complète de C: : quelques secondes.</li>
        <li><strong>simple (mono-thread)</strong> — même API mais un seul thread ; plus lent, utile pour comparer.</li>
        <li><strong>portable / référence</strong> — lecture de répertoire générique, compatible avec tout système de fichiers ; plus lent. À utiliser si les modes rapides manquent quelque chose.</li>
      </ul>`,
      `<p>Les <strong>points d'analyse</strong> (liens symboliques, jonctions, points de montage) ne sont jamais suivis ni comptés : une analyse ne peut donc pas boucler ni compter deux fois.</p>`
    ]
  },
  {
    h: "Onglet Nettoyage — récupérer de l'espace",
    b: [
      `<p>Nettoyage recherche les <em>fichiers inutiles</em> : ceux que Windows et les applications recréent de toute façon (dossiers temporaires, caches, restes de mises à jour, journaux, vignettes). Ils sont classés en deux catégories :</p>`,
      `<ul>
        <li><strong>sûrs</strong> — aucune donnée utilisateur ; espace de travail régénérable. Présélectionnés.</li>
        <li><strong>facultatifs</strong> — réversibles, mais coûtent un retéléchargement ou une reconstruction (ex. cache de shaders d'un jeu). À cocher si vous voulez l'espace en plus.</li>
      </ul>`,
      `<p>Chaque ligne affiche un badge expliquant <em>pourquoi</em> c'est inutile. Ensuite :</p>`,
      `<ol>
        <li>Utilisez les filtres (<em>tous / sûrs / facultatifs</em>) et tout sélectionner/désélectionner pour choisir quoi supprimer.</li>
        <li>Suivez le total « sélectionnés » (nombre + taille) mis à jour à chaque coche.</li>
        <li>Cliquez sur <strong>Mettre à la corbeille</strong> (réversible) ou <strong>Supprimer définitivement</strong>. Une confirmation vous prévient d'abord.</li>
      </ol>`,
      `<p class="help-note">Les fichiers très volumineux ne tiennent pas dans la corbeille et sont supprimés définitivement même si vous choisissez « corbeille » — la boîte de confirmation le rappelle.</p>`,
      `<p class="help-note">Les fichiers en cours d'utilisation, ou appartenant au système sans élévation, sont ignorés et signalés comme « toujours présents (en cours d'utilisation ou accès refusé) ».</p>`
    ]
  },
  {
    h: "Onglet Doublons — supprimer les copies en double",
    b: [
      `<ol>
        <li>Survolez une carte de lecteur et cliquez sur <strong>Chercher les doublons</strong>.</li>
        <li>Définissez un <strong>fichier minimal</strong> (1 Mo par défaut) pour ignorer les petits fichiers, et choisissez la règle de <strong>conservation</strong> : <em>la plus ancienne</em>, <em>la plus récente</em> ou <em>le chemin le plus court</em>.</li>
        <li>Seuls les fichiers dont la <em>taille est partagée avec un autre fichier</em> sont hachés, ce qui rend l'analyse rapide. Les groupes sont triés par espace récupérable.</li>
        <li>Chaque groupe liste toutes les copies. L'<strong>étoile</strong> marque la copie conservée — cliquez sur une autre copie pour la conserver à la place.</li>
        <li>Cliquez sur <strong>Mettre à la corbeille</strong> ou <strong>Supprimer définitivement</strong>. Une copie par groupe est toujours conservée ; la dernière ne peut jamais être supprimée.</li>
      </ol>`,
      `<p class="help-note">Les fichiers sont comparés par contenu, pas par nom ni par date : des fichiers aux noms ou dates différents mais aux octets identiques sont bien détectés comme doublons.</p>`
    ]
  },
  {
    h: "Onglet Statistiques — espace par type de fichier",
    b: [
      `<ol>
        <li>Survolez une carte de lecteur et cliquez sur <strong>Analyser</strong>.</li>
        <li>À la fin, les fichiers sont répartis par extension en : Images, Vidéos, Audio, Documents, Archives, Exécutables, Code et Autre.</li>
        <li>Une barre empilée montre la part de chaque catégorie, et une légende liste chaque catégorie avec sa taille, une mini-barre, le pourcentage et le nombre de fichiers.</li>
      </ol>`,
      `<p>Les mini-barres sont remplies par rapport à la <strong>capacité totale du disque</strong>, pour voir la place de chaque type sur le lecteur. Survolez une ligne pour les chiffres exacts.</p>`
    ]
  },
  {
    h: "Comprendre les chiffres",
    b: [
      `<ul>
        <li><strong>analysés / fichiers</strong> — nombre de fichiers trouvés.</li>
        <li><strong>taille totale</strong> — taille cumulée de tout ce qui a été trouvé.</li>
        <li><strong>durée</strong> — temps pris par l'analyse.</li>
        <li><strong>barre de taille</strong> — la barre verte de chaque ligne montre la taille du fichier par rapport au plus gros de la liste, pour repérer les cas extrêmes.</li>
        <li><strong>récupérable</strong> — espace qui serait libéré en supprimant la sélection actuelle.</li>
      </ul>`
    ]
  },
  {
    h: "Sécurité et confidentialité",
    b: [
      `<ul>
        <li>Rien ne quitte votre machine — aucune télémétrie, aucun appel réseau.</li>
        <li>La suppression peut aller à la <strong>corbeille</strong> (récupérable) ou être <strong>définitive</strong>. En cas de doute, utilisez la corbeille.</li>
        <li>Les fichiers système protégés (pagefile, hiberfil, configuration de démarrage, System Volume Information) ne sont jamais touchés.</li>
        <li>Chaque action destructive demande confirmation, et les suppressions en masse montrent exactement ce qui sera supprimé.</li>
      </ul>`
    ]
  },
  {
    h: "Astuces",
    b: [
      `<ul>
        <li>Les analyses sont annulables à tout moment — les résultats partiels restent à l'écran.</li>
        <li>Seule la liste défile ; les contrôles restent en place quand vous redimensionnez la fenêtre.</li>
        <li>Des écarts d'une fraction de pourcentage entre deux analyses sont normaux — les fichiers changent pendant que Windows tourne.</li>
        <li>Pour un très gros disque, commencez par Statistiques pour la vue d'ensemble, puis Nettoyage et Doublons.</li>
      </ul>`
    ]
  },
  {
    h: "Glossaire",
    b: [
      `<dl class="help-glossary">
        <dt>fichier inutile</dt><dd>Fichier régénérable (temporaire, cache, journal) supprimable pour libérer de l'espace.</dd>
        <dt>point d'analyse</dt><dd>Lien symbolique/jonction/point de montage. Greater ne les suit jamais.</dd>
        <dt>lien physique</dt><dd>Deux noms pointant vers un même fichier sur le disque. Compté une fois, jamais traité comme doublon.</dd>
        <dt>récupérable</dt><dd>Espace qui serait libéré si les éléments sélectionnés sont supprimés.</dd>
        <dt>élevé</dt><dd>Exécution avec des droits administrateur, nécessaire seulement pour atteindre des fichiers système verrouillés.</dd>
      </dl>`
    ]
  }
];

HELP.es = [
  {
    h: "¿Qué es Greater?",
    b: [
      `<p>Greater es un <strong>analizador de espacio en disco para Windows</strong>. Analiza tus unidades rápidamente, muestra exactamente qué ocupa espacio y ofrece herramientas seguras para recuperarlo: encontrar archivos basura, localizar copias duplicadas y ver un desglose por tipo de archivo.</p>`,
      `<p>Todo se ejecuta en tu PC. No se sube nada a ningún sitio. No requiere derechos de administrador para el uso normal; la elevación solo es necesaria para acceder a zonas del sistema bloqueadas (una insignia arriba a la derecha indica cuándo está elevado).</p>`
    ]
  },
  {
    h: "Las cuatro pestañas",
    b: [
      `<p>La aplicación se divide en cuatro secciones, accesibles desde la barra de pestañas bajo la cabecera:</p>`,
      `<ul>
        <li><strong>Explorador</strong> — analiza una carpeta o unidad y examina cada archivo, del mayor al menor. Es la vista principal de «qué está llenando mi disco».</li>
        <li><strong>Limpieza</strong> — busca basura conocida (archivos temporales, cachés, restos de actualizaciones) y bórrala para recuperar espacio.</li>
        <li><strong>Duplicados</strong> — busca archivos idénticos byte a byte y borra todas las copias menos una de cada grupo.</li>
        <li><strong>Estadísticas</strong> — analiza una unidad y ve cómo se reparte el espacio por tipo de archivo (imágenes, vídeos, audio, documentos, archivos comprimidos, ejecutables, código, otros).</li>
      </ul>`
    ]
  },
  {
    h: "Primeros pasos (Explorador)",
    b: [
      `<ol>
        <li>Pase el cursor por una <strong>tarjeta de unidad</strong> arriba y pulse su botón, o escriba una ruta (p. ej. <code>D:\\Juegos</code>) en la casilla.</li>
        <li>Pulse <strong>Analizar</strong>. Aparecen una barra de progreso y contadores en vivo mientras recorre el árbol.</li>
        <li>Al terminar, la lista muestra los archivos <strong>del mayor al menor</strong> con una barra de tamaño. Use <strong>Cargar más</strong> para paginar, o cambie <strong>Mostrar por</strong> a <em>Por carpeta</em> para agrupar cada carpeta en una fila.</li>
        <li>Pase el cursor por una fila para las acciones: <em>información</em>, <em>abrir ubicación</em>, <em>mover a la Papelera</em>, <em>eliminar permanentemente</em>.</li>
      </ol>`,
      `<p>Los seis recuadros sobre la lista resumen el análisis: archivos encontrados, tamaño total, tiempo, archivo mayor, tamaño medio y ruta más profunda.</p>`
    ]
  },
  {
    h: "Modos de análisis (lista junto a la ruta)",
    b: [
      `<ul>
        <li><strong>rápido (paralelo)</strong> — recomendado. Usa la API nativa de búsqueda rápida de Windows en varios subprocesos. Análisis completo de C: típico: unos segundos.</li>
        <li><strong>simple (un hilo)</strong> — misma API pero un solo hilo; más lento, útil para comparar.</li>
        <li><strong>portátil / referencia</strong> — lectura de directorios genérica, válida para cualquier sistema de archivos; más lenta. Úsela si los modos rápidos omiten algo.</li>
      </ul>`,
      `<p>Los <strong>puntos de reanálisis</strong> (enlaces simbólicos, uniones, puntos de montaje) nunca se siguen ni se cuentan, así que un análisis no puede entrar en bucle ni contar dos veces.</p>`
    ]
  },
  {
    h: "Pestaña Limpieza — recuperar espacio",
    b: [
      `<p>Limpieza busca <em>basura</em>: archivos que Windows y las apps regeneran de todos modos (temporales, cachés, restos de actualizaciones, registros, miniaturas). Se agrupan en dos categorías:</p>`,
      `<ul>
        <li><strong>seguros</strong> — sin datos de usuario; espacio regenerable. Preseleccionados.</li>
        <li><strong>opcionales</strong> — reversibles, pero cuestan una descarga o reconstrucción (p. ej. la caché de shaders de un juego). Actívelos si quiere el espacio extra.</li>
      </ul>`,
      `<p>Cada fila muestra una insignia que explica <em>por qué</em> es basura. Después:</p>`,
      `<ol>
        <li>Use los filtros (<em>todos / seguros / opcionales</em>) y seleccionar todo/ninguno para elegir qué quitar.</li>
        <li>Mire el total «seleccionados» (cantidad + tamaño) actualizarse al marcar.</li>
        <li>Pulse <strong>Mover a la Papelera</strong> (reversible) o <strong>Eliminar permanentemente</strong>. Antes aparece una confirmación.</li>
      </ol>`,
      `<p class="help-note">Los archivos muy grandes no caben en la Papelera y se eliminan permanentemente aunque elija «Papelera»: el diálogo de confirmación se lo recuerda.</p>`,
      `<p class="help-note">Los archivos en uso, o propiedad del sistema sin elevación, se omiten y se informan como «siguen presentes (en uso o acceso denegado)».</p>`
    ]
  },
  {
    h: "Pestaña Duplicados — quitar copias duplicadas",
    b: [
      `<ol>
        <li>Pase el cursor por una tarjeta de unidad y pulse <strong>Buscar duplicados</strong>.</li>
        <li>Fije un <strong>archivo mínimo</strong> (1 MB por defecto) para ignorar los pequeños, y elija la regla de <strong>conservación</strong>: <em>más antigua</em>, <em>más reciente</em> o <em>ruta más corta</em>.</li>
        <li>Solo se aplica hash a los archivos cuyo <em>tamaño coincide con otro</em>, así el análisis es rápido. Los grupos se ordenan por espacio recuperable.</li>
        <li>Cada grupo lista todas las copias. La <strong>estrella</strong> marca la copia que se conservará; pulse otra copia para conservarla en su lugar.</li>
        <li>Pulse <strong>Mover a la Papelera</strong> o <strong>Eliminar permanentemente</strong>. Siempre se conserva exactamente una copia por grupo; la última nunca se puede borrar.</li>
      </ol>`,
      `<p class="help-note">Los archivos se comparan por contenido, no por nombre ni fecha: archivos con nombres o fechas distintos pero bytes idénticos se detectan igualmente como duplicados.</p>`
    ]
  },
  {
    h: "Pestaña Estadísticas — espacio por tipo de archivo",
    b: [
      `<ol>
        <li>Pase el cursor por una tarjeta de unidad y pulse <strong>Analizar</strong>.</li>
        <li>Al terminar, los archivos se agrupan por extensión en: Imágenes, Vídeos, Audio, Documentos, Archivos comprimidos, Ejecutables, Código y Otros.</li>
        <li>Una barra apilada muestra la cuota de cada categoría, y una leyenda lista cada categoría con su tamaño, una mini barra, el porcentaje y el número de archivos.</li>
      </ol>`,
      `<p>Las mini barras se llenan respecto a la <strong>capacidad total del disco</strong>, para ver cuánto ocupa cada tipo en la unidad. Pase el cursor por una fila para cifras exactas.</p>`
    ]
  },
  {
    h: "Entender las cifras",
    b: [
      `<ul>
        <li><strong>analizados / archivos</strong> — cuántos archivos se encontraron.</li>
        <li><strong>tamaño total</strong> — tamaño combinado de todo lo encontrado.</li>
        <li><strong>tiempo</strong> — cuánto tardó el análisis.</li>
        <li><strong>barra de tamaño</strong> — la barra verde de cada fila muestra el tamaño del archivo respecto al mayor de la lista, para destacar los casos extremos.</li>
        <li><strong>recuperable</strong> — espacio que se liberaría al borrar la selección actual.</li>
      </ul>`
    ]
  },
  {
    h: "Seguridad y privacidad",
    b: [
      `<ul>
        <li>Nada sale de su equipo: sin telemetría ni llamadas de red.</li>
        <li>Borrar puede ir a la <strong>Papelera</strong> (recuperable) o ser <strong>permanente</strong>. En caso de duda, use la Papelera.</li>
        <li>Los archivos de sistema protegidos (pagefile, hiberfil, configuración de arranque, System Volume Information) nunca se tocan.</li>
        <li>Toda acción destructiva pide confirmación antes, y los borrados masivos muestran exactamente qué se eliminará.</li>
      </ul>`
    ]
  },
  {
    h: "Consejos",
    b: [
      `<ul>
        <li>Los análisis se pueden cancelar en cualquier momento; los resultados parciales permanecen en pantalla.</li>
        <li>Solo se desplaza la lista; los controles se quedan en su sitio al cambiar el tamaño de la ventana.</li>
        <li>Diferencias de una fracción de punto porcentual entre análisis son normales: los archivos cambian mientras Windows se ejecuta.</li>
        <li>Para una unidad enorme, empiece por Estadísticas para la visión general, luego Limpieza y Duplicados.</li>
      </ul>`
    ]
  },
  {
    h: "Glosario",
    b: [
      `<dl class="help-glossary">
        <dt>basura</dt><dd>Archivos regenerables (temporales, cachés, registros) que se pueden borrar para liberar espacio.</dd>
        <dt>punto de reanálisis</dt><dd>Enlace simbólico/unión/punto de montaje. Greater nunca los sigue.</dd>
        <dt>vínculo físico</dt><dd>Dos nombres que apuntan a un mismo archivo en disco. Se cuenta una vez y nunca se trata como duplicado.</dd>
        <dt>recuperable</dt><dd>Espacio que se liberaría si se borran los elementos seleccionados.</dd>
        <dt>elevado</dt><dd>Ejecución con derechos de administrador, necesaria solo para acceder a archivos de sistema bloqueados.</dd>
      </dl>`
    ]
  }
];

HELP.de = [
  {
    h: "Was ist Greater?",
    b: [
      `<p>Greater ist ein <strong>Festplatten-Analyseprogramm für Windows</strong>. Es scannt Laufwerke schnell, zeigt genau, was Platz belegt, und bietet sichere Werkzeuge, ihn zurückzugewinnen — Ballastdateien finden, doppelte Kopien aufspüren und eine Auswertung nach Dateityp ansehen.</p>`,
      `<p>Alles läuft auf Ihrem PC. Nichts wird irgendwohin hochgeladen. Für den normalen Gebrauch sind keine Administratorrechte nötig; Erhöhung ist nur für gesperrte Systembereiche erforderlich (ein Abzeichen oben rechts zeigt sie an).</p>`
    ]
  },
  {
    h: "Die vier Tabs",
    b: [
      `<p>Die App besteht aus vier Bereichen, erreichbar über die Tab-Leiste unter der Kopfzeile:</p>`,
      `<ul>
        <li><strong>Explorer</strong> — Ordner oder Laufwerk scannen und jede Datei durchsehen, größte zuerst. Die Hauptansicht für „Was belegt meinen Platz?“.</li>
        <li><strong>Aufräumen</strong> — nach bekanntem Ballast suchen (temporäre Dateien, Caches, Update-Reste) und ihn zum Freigeben löschen.</li>
        <li><strong>Duplikate</strong> — nach byte-identischen Dateien suchen und alle bis auf eine Kopie je Gruppe löschen.</li>
        <li><strong>Statistik</strong> — ein Laufwerk scannen und sehen, wie der Platz nach Dateityp verteilt ist (Bilder, Videos, Audio, Dokumente, Archive, Programme, Code, Sonstiges).</li>
      </ul>`
    ]
  },
  {
    h: "Erste Schritte (Explorer)",
    b: [
      `<ol>
        <li>Laufwerkskarte oben überfahren und deren Button klicken, oder einen Pfad (z. B. <code>D:\\Spiele</code>) ins Pfadfeld eingeben.</li>
        <li><strong>Scannen</strong> drücken. Während des Durchlaufs erscheinen Fortschrittsbalken und Live-Zähler.</li>
        <li>Danach zeigt die Liste Dateien <strong>größte zuerst</strong> mit Größenbalken. Mit <strong>Mehr laden</strong> blättern, oder <strong>Auflisten nach</strong> auf <em>Nach Ordner</em> stellen, um jeden Ordner zu einer Zeile zusammenzufassen.</li>
        <li>Zeile überfahren für Aktionen: <em>Infos</em>, <em>Speicherort öffnen</em>, <em>in den Papierkorb</em>, <em>endgültig löschen</em>.</li>
      </ol>`,
      `<p>Die sechs Kacheln über der Liste fassen den Scan zusammen: gefundene Dateien, Gesamtgröße, Dauer, größte Datei, Durchschnittsgröße und tiefster Pfad.</p>`
    ]
  },
  {
    h: "Scan-Modi (Auswahlliste neben dem Pfad)",
    b: [
      `<ul>
        <li><strong>schnell (parallel)</strong> — empfohlen. Nutzt die native Windows-Suchschnittstelle über viele Threads. Typischer C:-Komplettscan: wenige Sekunden.</li>
        <li><strong>einfach (ein Thread)</strong> — gleiche API, ein Thread; langsamer, gut zum Vergleichen.</li>
        <li><strong>portabel / Referenz</strong> — generisches Verzeichnislesen, funktioniert auf jedem Dateisystem; langsamer. Nutzen, wenn die schnellen Modi etwas übersehen.</li>
      </ul>`,
      `<p><strong>Reparse-Punkte</strong> (Symlinks, Junctions, Mount-Punkte) werden nie verfolgt oder gezählt — ein Scan kann dadurch weder schleifen noch doppelt zählen.</p>`
    ]
  },
  {
    h: "Tab Aufräumen — Platz zurückgewinnen",
    b: [
      `<p>Aufräumen sucht <em>Ballast</em>: Dateien, die Windows und Apps ohnehin neu erzeugen (Temp-Ordner, Caches, Update-Reste, Protokolle, Miniaturansichten). Sie sind in zwei Kategorien geteilt:</p>`,
      `<ul>
        <li><strong>sicher</strong> — keine Benutzerdaten; regenerierbarer Arbeitsbereich. Vorausgewählt.</li>
        <li><strong>optional</strong> — umkehrbar, kostet aber einen erneuten Download oder Neuaufbau (z. B. Shader-Cache eines Spiels). Nur anhaken, wenn der Extraplatz gewünscht ist.</li>
      </ul>`,
      `<p>Jede Zeile zeigt ein Abzeichen, das <em>warum</em> erklärt. Dann:</p>`,
      `<ol>
        <li>Mit den Filtern (<em>alle / sicher / optional</em>) und Alle/Keine auswählen, was entfernt wird.</li>
        <li>Die Live-Summe „ausgewählt“ (Anzahl + Größe) aktualisiert sich beim Anhaken.</li>
        <li><strong>In den Papierkorb</strong> (umkehrbar) oder <strong>Endgültig löschen</strong> klicken. Vorher warnt eine Bestätigung.</li>
      </ol>`,
      `<p class="help-note">Sehr große Dateien passen nicht in den Papierkorb und werden auch bei „Papierkorb“ endgültig entfernt — der Bestätigungsdialog erinnert daran.</p>`,
      `<p class="help-note">Dateien in Benutzung oder im Systembesitz ohne Erhöhung werden übersprungen und als „noch vorhanden (in Benutzung oder Zugriff verweigert)“ gemeldet.</p>`
    ]
  },
  {
    h: "Tab Duplikate — doppelte Kopien entfernen",
    b: [
      `<ol>
        <li>Laufwerkskarte überfahren und <strong>Duplikate suchen</strong> klicken.</li>
        <li>Eine <strong>Mindestgröße</strong> setzen (Standard 1 MB), damit winzige Dateien ignoriert werden, und die <strong>Behalten</strong>-Regel wählen: <em>älteste</em>, <em>neueste</em> oder <em>kürzester Pfad</em>.</li>
        <li>Nur Dateien, deren <em>Größe mit einer anderen geteilt wird</em>, werden gehasht — der Scan bleibt schnell. Gruppen sind nach freigebbarem Platz sortiert.</li>
        <li>Jede Gruppe listet alle Kopien. Der <strong>Stern</strong> markiert die zu behaltende Kopie — eine andere Kopie anklicken, um sie stattdessen zu behalten.</li>
        <li><strong>In den Papierkorb</strong> oder <strong>Endgültig löschen</strong> klicken. Pro Gruppe bleibt immer genau eine Kopie; die letzte kann nie gelöscht werden.</li>
      </ol>`,
      `<p class="help-note">Dateien werden nach Inhalt verglichen, nicht nach Name oder Zeitstempel — anders benannte oder datierte Dateien mit identischen Bytes werden trotzdem als Duplikate erkannt.</p>`
    ]
  },
  {
    h: "Tab Statistik — Platz nach Dateityp",
    b: [
      `<ol>
        <li>Laufwerkskarte überfahren und <strong>Analysieren</strong> klicken.</li>
        <li>Danach werden Dateien nach Endung gruppiert: Bilder, Videos, Audio, Dokumente, Archive, Programme, Code und Sonstiges.</li>
        <li>Ein gestapelter Balken zeigt den Anteil jeder Kategorie, eine Legende listet Größe, Mini-Balken, Prozent und Dateianzahl.</li>
      </ol>`,
      `<p>Die Mini-Balken füllen sich relativ zur <strong>Gesamtkapazität des Datenträgers</strong>, sodass der Anteil jedes Typs sichtbar ist. Zeile überfahren für genaue Zahlen.</p>`
    ]
  },
  {
    h: "Zahlen verstehen",
    b: [
      `<ul>
        <li><strong>gescannt / Dateien</strong> — wie viele Dateien gefunden wurden.</li>
        <li><strong>Gesamtgröße</strong> — summierte Größe aller Funde.</li>
        <li><strong>Dauer</strong> — wie lange der Scan dauerte.</li>
        <li><strong>Größenbalken</strong> — der grüne Balken je Zeile zeigt die Größe relativ zur größten Datei der Liste, damit Ausreißer auffallen.</li>
        <li><strong>freigebbar</strong> — Platz, der durch Löschen der aktuellen Auswahl frei würde.</li>
      </ul>`
    ]
  },
  {
    h: "Sicherheit & Datenschutz",
    b: [
      `<ul>
        <li>Nichts verlässt Ihren Rechner — keine Telemetrie, keine Netzwerkaufrufe.</li>
        <li>Löschen geht in den <strong>Papierkorb</strong> (wiederherstellbar) oder ist <strong>endgültig</strong>. Im Zweifel den Papierkorb nutzen.</li>
        <li>Geschützte Systemdateien (pagefile, hiberfil, Startkonfiguration, System Volume Information) werden nie angefasst.</li>
        <li>Jede zerstörende Aktion fragt zuerst nach, und Massenlöschungen zeigen genau, was entfernt wird.</li>
      </ul>`
    ]
  },
  {
    h: "Tipps",
    b: [
      `<ul>
        <li>Scans sind jederzeit abbrechbar — Teilergebnisse bleiben sichtbar.</li>
        <li>Nur die Liste scrollt; die Bedienelemente bleiben beim Größenändern des Fensters an Ort und Stelle.</li>
        <li>Unterschiede von Bruchteilen eines Prozents zwischen Scans sind normal — Dateien ändern sich, während Windows läuft.</li>
        <li>Bei einem riesigen Laufwerk mit Statistik beginnen, dann Aufräumen und Duplikate.</li>
      </ul>`
    ]
  },
  {
    h: "Glossar",
    b: [
      `<dl class="help-glossary">
        <dt>Ballast</dt><dd>Regenerierbare Dateien (Temp, Caches, Protokolle), die zum Freigeben gelöscht werden können.</dd>
        <dt>Reparse-Punkt</dt><dd>Symlink/Junction/Mount-Punkt. Greater folgt ihnen nie.</dd>
        <dt>Hardlink</dt><dd>Zwei Namen für eine Datei auf dem Datenträger. Einmal gezählt, nie als Duplikat behandelt.</dd>
        <dt>freigebbar</dt><dd>Platz, der frei würde, wenn die ausgewählten Elemente gelöscht werden.</dd>
        <dt>erhöht</dt><dd>Ausführung mit Administratorrechten, nur für gesperrte Systemdateien nötig.</dd>
      </dl>`
    ]
  }
];

HELP.ar = [
  {
    h: "ما هو Greater؟",
    b: [
      `<p>Greater هو <strong>محلّل لمساحة القرص في Windows</strong>. يفحص أقراصك بسرعة، ويعرض بدقة ما يستهلك المساحة، ويقدّم أدوات آمنة لاستعادتها — العثور على الملفات غير الضرورية، وتحديد النسخ المكرّرة، وعرض توزيع البيانات حسب نوع الملف.</p>`,
      `<p>يعمل كليًا على جهازك. لا يُرسَل شيء إلى أي مكان. لا يحتاج صلاحيات المسؤول للاستخدام العادي؛ رفع الصلاحيات مطلوب فقط للوصول إلى مناطق النظام المقفلة (تظهر شارة في أعلى اليمين عند الرفع).</p>`
    ]
  },
  {
    h: "التبويبات الأربعة",
    b: [
      `<p>ينقسم التطبيق إلى أربعة أقسام، تُفتح من شريط التبويبات أسفل الرأس:</p>`,
      `<ul>
        <li><strong>المستكشف</strong> — افحص مجلدًا أو قرصًا وتصفّح كل ملف، الأكبر أولًا. هذه هي الواجهة الرئيسية لمعرفة «ما الذي يملأ مساحتي».</li>
        <li><strong>التنظيف</strong> — ابحث عن الملفات غير الضرورية المعروفة (الملفات المؤقتة، الذاكرات، بقايا التحديثات) واحذفها لاستعادة المساحة.</li>
        <li><strong>المكرّرات</strong> — ابحث عن ملفات متطابقة بايتًا ببايت واحذف كل النسخ إلا واحدة من كل مجموعة.</li>
        <li><strong>الإحصاءات</strong> — افحص قرصًا واعرف كيف تتوزّع مساحته حسب نوع الملف (صور، فيديو، صوت، مستندات، أرشيفات، برامج تنفيذية، شيفرة، أخرى).</li>
      </ul>`
    ]
  },
  {
    h: "البداية (المستكشف)",
    b: [
      `<ol>
        <li>مرّر فوق <strong>بطاقة قرص</strong> في الأعلى واضغط زرها، أو اكتب مسارًا (مثل <code>D:\\Games</code>) في حقل المسار.</li>
        <li>اضغط <strong>فحص</strong>. يظهر شريط تقدّم وعدّادات حيّة أثناء المرور على الشجرة.</li>
        <li>عند الانتهاء تعرض القائمة الملفات <strong>الأكبر أولًا</strong> مع شريط حجم لكل منها. استخدم <strong>تحميل المزيد</strong> للتنقّل، أو غيّر <strong>العرض حسب</strong> إلى <em>حسب المجلد</em> لتجميع كل مجلد في صف واحد.</li>
        <li>مرّر فوق أي صف لإجراءات الملف: <em>المعلومات</em>، <em>فتح الموقع</em>، <em>نقل إلى سلة المحذوفات</em>، <em>حذف نهائي</em>.</li>
      </ol>`,
      `<p>البطاقات الست فوق القائمة تلخّص الفحص: الملفات التي عُثر عليها، الحجم الكلي، المدة، أكبر ملف، متوسط الحجم، وأعمق مسار.</p>`
    ]
  },
  {
    h: "أوضاع الفحص (القائمة بجانب المسار)",
    b: [
      `<ul>
        <li><strong>سريع (متوازٍ)</strong> — موصى به. يستخدم واجهة البحث السريع الأصلية في Windows عبر عدة خيوط. فحص C: الكامل عادةً: ثوانٍ قليلة.</li>
        <li><strong>بسيط (خيط واحد)</strong> — نفس الواجهة بخيط واحد؛ أبطأ، مفيد للمقارنة.</li>
        <li><strong>محمول / مرجعي</strong> — قراءة أدلة عامة تعمل على أي نظام ملفات؛ أبطأ. استخدمه إذا فات الأوضاع السريعة شيء.</li>
      </ul>`,
      `<p>لا تُتبَع <strong>نقاط إعادة التحليل</strong> (الروابط الرمزية والوصلات ونقاط التركيب) ولا تُحتسب أبدًا، لذا لا يمكن أن يدور الفحص أو يعدّ مرتين.</p>`
    ]
  },
  {
    h: "تبويب التنظيف — استعادة المساحة",
    b: [
      `<p>يبحث التنظيف عن <em>الملفات غير الضرورية</em>: ملفات يعيد Windows والتطبيقات إنشاءها أصلًا (مجلدات مؤقتة، ذاكرات، بقايا تحديثات، سجلات، صور مصغّرة). وتُصنَّف إلى فئتين:</p>`,
      `<ul>
        <li><strong>آمنة</strong> — لا بيانات مستخدم؛ مساحة قابلة لإعادة الإنشاء. محددة مسبقًا.</li>
        <li><strong>اختيارية</strong> — قابلة للتراجع، لكنها تكلّف إعادة تنزيل أو إعادة بناء (مثل ذاكرة شيدر لعبة). فعّلها إن أردت المساحة الإضافية.</li>
      </ul>`,
      `<p>يعرض كل صف شارة تشرح <em>سبب</em> اعتباره غير ضروري. بعد ذلك:</p>`,
      `<ol>
        <li>استخدم عوامل التصفية (<em>الكل / آمنة / اختيارية</em>) وتحديد الكل/لا شيء لاختيار ما يُزال.</li>
        <li>راقب إجمالي «المحدد» (العدد + الحجم) يتحدّث عند التحديد.</li>
        <li>اضغط <strong>نقل إلى سلة المحذوفات</strong> (قابل للتراجع) أو <strong>حذف نهائي</strong>. يظهر تحذير تأكيد أولًا.</li>
      </ol>`,
      `<p class="help-note">الملفات الكبيرة جدًا لا تتسع في سلة المحذوفات وتُحذف نهائيًا حتى عند اختيار «السلة» — يذكّرك حوار التأكيد بذلك.</p>`,
      `<p class="help-note">تُتجاوز الملفات قيد الاستخدام أو المملوكة للنظام دون رفع صلاحيات، ويُبلَّغ عنها بـ«لا يزال موجودًا (قيد الاستخدام أو تم رفض الوصول)».</p>`
    ]
  },
  {
    h: "تبويب المكرّرات — إزالة النسخ المكرّرة",
    b: [
      `<ol>
        <li>مرّر فوق بطاقة قرص واضغط <strong>البحث عن المكرّرات</strong>.</li>
        <li>حدّد <strong>أصغر ملف</strong> (1 ميغابايت افتراضيًا) لتجاهل الملفات الصغيرة، واختر قاعدة <strong>الاحتفاظ</strong>: <em>الأقدم</em> أو <em>الأحدث</em> أو <em>أقصر مسار</em>.</li>
        <li>تُحسب بصمة المحتوى فقط للملفات التي <em>يتشارك حجمها مع ملف آخر</em>، لذا يكون الفحص سريعًا. وتُرتَّب المجموعات حسب المساحة القابلة للاستعادة.</li>
        <li>تسرد كل مجموعة كل النسخ. تشير <strong>النجمة</strong> إلى النسخة التي ستُحفظ — اضغط نسخة أخرى للاحتفاظ بها بدلًا منها.</li>
        <li>اضغط <strong>نقل إلى سلة المحذوفات</strong> أو <strong>حذف نهائي</strong>. تُحفظ نسخة واحدة بالضبط من كل مجموعة؛ ولا يمكن حذف النسخة الأخيرة أبدًا.</li>
      </ol>`,
      `<p class="help-note">تُقارَن الملفات بالمحتوى لا بالاسم أو التاريخ — فالملفات المختلفة اسمًا أو تاريخًا والمتطابقة بايتًا تُكتشف كمكرّرات.</p>`
    ]
  },
  {
    h: "تبويب الإحصاءات — المساحة حسب نوع الملف",
    b: [
      `<ol>
        <li>مرّر فوق بطاقة قرص واضغط <strong>تحليل</strong>.</li>
        <li>عند الانتهاء تُصنَّف الملفات حسب الامتداد إلى: صور، فيديو، صوت، مستندات، أرشيفات، برامج تنفيذية، شيفرة، وأخرى.</li>
        <li>يعرض شريط مكدّس حصة كل فئة، وتعرض لائحة كل فئة بحجمها وشريط مصغّر ونسبتها وعدد ملفاتها.</li>
      </ol>`,
      `<p>تُملأ الأشرطة المصغّرة نسبةً إلى <strong>سعة القرص الكاملة</strong>، لترى مقدار ما تشغله كل فئة. مرّر فوق صف للأرقام الدقيقة.</p>`
    ]
  },
  {
    h: "فهم الأرقام",
    b: [
      `<ul>
        <li><strong>تم فحصها / الملفات</strong> — عدد الملفات التي عُثر عليها.</li>
        <li><strong>الحجم الكلي</strong> — الحجم المجمّع لكل ما عُثر عليه.</li>
        <li><strong>المدة</strong> — كم استغرق الفحص.</li>
        <li><strong>شريط الحجم</strong> — الشريط الأخضر في كل صف يبيّن حجم الملف نسبةً إلى أكبر ملف في القائمة، لإبراز الحالات الشاذة.</li>
        <li><strong>قابل للاستعادة</strong> — المساحة التي ستُحرَّر بحذف التحديد الحالي.</li>
      </ul>`
    ]
  },
  {
    h: "الأمان والخصوصية",
    b: [
      `<ul>
        <li>لا شيء يغادر جهازك — لا قياسات ولا اتصالات شبكة.</li>
        <li>يمكن أن يذهب الحذف إلى <strong>سلة المحذوفات</strong> (قابل للاستعادة) أو يكون <strong>نهائيًا</strong>. عند الشك استخدم السلة.</li>
        <li>ملفات النظام المحمية (pagefile وhiberfil وإعدادات الإقلاع وSystem Volume Information) لا تُمسّ أبدًا.</li>
        <li>كل إجراء مدمّر يطلب تأكيدًا أولًا، وتعرض الحذوفات الجماعية ما سيُزال بالضبط.</li>
      </ul>`
    ]
  },
  {
    h: "نصائح",
    b: [
      `<ul>
        <li>يمكن إلغاء الفحص في أي وقت — تبقى النتائج الجزئية على الشاشة.</li>
        <li>قائمة الملفات وحدها تمرّر؛ تبقى عناصر التحكم في مكانها عند تغيير حجم النافذة.</li>
        <li>فروق بجزء من المئة بين الفحوصات طبيعية — تتغيّر الملفات أثناء تشغيل Windows.</li>
        <li>لقرص ضخم ابدأ بالإحصاءات للصورة العامة، ثم التنظيف والمكرّرات.</li>
      </ul>`
    ]
  },
  {
    h: "المصطلحات",
    b: [
      `<dl class="help-glossary">
        <dt>ملف غير ضروري</dt><dd>ملف قابل لإعادة الإنشاء (مؤقت، ذاكرة، سجل) يمكن حذفه لتحرير مساحة.</dd>
        <dt>نقطة إعادة تحليل</dt><dd>رابط رمزي/وصلة/نقطة تركيب. لا يتبعها Greater أبدًا.</dd>
        <dt>رابط صلب</dt><dd>اسمان لملف واحد على القرص. يُحتسب مرة واحدة ولا يُعدّ مكرّرًا.</dd>
        <dt>قابل للاستعادة</dt><dd>المساحة التي ستُحرَّر إذا حُذفت العناصر المحددة حاليًا.</dd>
        <dt>بصلاحيات مرتفعة</dt><dd>التشغيل بصلاحيات المسؤول، يُحتاج إليه فقط للوصول إلى ملفات النظام المقفلة.</dd>
      </dl>`
    ]
  }
];

function curLang() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (LANGS.indexOf(saved) !== -1) return saved;
  } catch (e) { /* storage unavailable */ }
  return "en";
}

function t(key, params) {
  const dict = I18N[curLang()] || I18N.en;
  let s = dict[key];
  if (s == null) s = I18N.en[key];
  if (s == null) return key;
  if (params) {
    s = s.replace(/\{(\w+)\}/g, function (m, name) {
      return params[name] != null ? String(params[name]) : m;
    });
  }
  return s;
}

function renderHelp(lang) {
  const host = document.getElementById("help-body");
  if (!host) return;
  const sections = HELP[lang] || HELP.en;
  host.innerHTML = sections
    .map(function (sec) {
      return '<section class="help-section"><h4>' + sec.h + "</h4>" + sec.b.join("") + "</section>";
    })
    .join("");
}

function applyLang(lang) {
  if (LANGS.indexOf(lang) === -1) lang = "en";
  try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* ignore */ }
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";

  const textNodes = document.querySelectorAll("[data-i18n]");
  for (let i = 0; i < textNodes.length; i++) {
    const el = textNodes[i];
    el.textContent = t(el.getAttribute("data-i18n"));
  }
  const htmlNodes = document.querySelectorAll("[data-i18n-html]");
  for (let i = 0; i < htmlNodes.length; i++) {
    const el = htmlNodes[i];
    el.innerHTML = t(el.getAttribute("data-i18n-html"));
  }
  const phNodes = document.querySelectorAll("[data-i18n-ph]");
  for (let i = 0; i < phNodes.length; i++) {
    phNodes[i].setAttribute("placeholder", t(phNodes[i].getAttribute("data-i18n-ph")));
  }
  const titleNodes = document.querySelectorAll("[data-i18n-title]");
  for (let i = 0; i < titleNodes.length; i++) {
    titleNodes[i].setAttribute("title", t(titleNodes[i].getAttribute("data-i18n-title")));
  }
  const ariaNodes = document.querySelectorAll("[data-i18n-aria]");
  for (let i = 0; i < ariaNodes.length; i++) {
    ariaNodes[i].setAttribute("aria-label", t(ariaNodes[i].getAttribute("data-i18n-aria")));
  }

  ["lang-select", "firstrun-lang"].forEach(function (id) {
    const sel = document.getElementById(id);
    if (sel) sel.value = lang;
  });

  renderHelp(lang);
  if (typeof window.__onLangChange === "function") window.__onLangChange(lang);
}

window.t = t;
window.curLang = curLang;
window.applyLang = applyLang;
window.renderHelp = renderHelp;
