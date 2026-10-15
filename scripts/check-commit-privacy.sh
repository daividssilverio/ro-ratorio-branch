#!/bin/sh
# Refuses a commit that would publish details of the author's machine or
# accounts. It reads the git index, so it sees exactly what would be committed.
#
#   check-commit-privacy.sh                   staged files
#   check-commit-privacy.sh --tracked         every tracked file
#   check-commit-privacy.sh --message <file>  a commit message
#
# Exit status: 0 clean, 1 findings, 2 usage or git error.
# A reviewed false positive is silenced by adding its exact text to
# .commit-privacy-allowlist, one entry per line.
set -u

repository_root=$(git rev-parse --show-toplevel) || exit 2
cd "$repository_root" || exit 2

work_directory=$(mktemp -d) || exit 2
trap 'rm -rf "$work_directory"' EXIT
scanned_content="$work_directory/scanned-content"
allowed_texts="$work_directory/allowed-texts"
findings="$work_directory/findings"
unreviewed_findings="$work_directory/unreviewed-findings"
: > "$findings"

local_user_name=$(id -un)
local_host_name=$(hostname -s 2>/dev/null || hostname)

# record_matches <finding kind> <content label> <grep options and patterns...>
record_matches() {
    finding_kind=$1
    content_label=$2
    shift 2
    grep -n -I "$@" "$scanned_content" 2>/dev/null |
        cut -c 1-200 |
        awk -v kind="$finding_kind" -v label="$content_label" '{ print kind "\t" label ":" $0 }' >> "$findings"
}

scan_content() {
    content_label=$1

    record_matches home-directory-path "$content_label" -E \
        -e '(/Users/|/home/|[A-Za-z]:\\Users\\)[A-Za-z0-9._-]+'

    if [ ${#local_user_name} -ge 3 ]; then
        record_matches local-user-name "$content_label" -i -w -F -e "$local_user_name"
    fi

    case $local_host_name in
        '' | localhost) ;;
        *) record_matches local-host-name "$content_label" -i -F -e "$local_host_name" ;;
    esac

    record_matches email-address "$content_label" -E \
        -e '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'

    record_matches secret "$content_label" -E \
        -e '-----BEGIN [A-Z ]*PRIVATE KEY-----' \
        -e 'gh[pousr]_[A-Za-z0-9]{36}' \
        -e 'github_pat_[A-Za-z0-9_]{20,}' \
        -e 'sk-[A-Za-z0-9_-]{32,}' \
        -e 'AKIA[0-9A-Z]{16}' \
        -e 'xox[abprs]-[A-Za-z0-9-]{10,}'

    record_matches private-link "$content_label" -E \
        -e 'claude\.ai/[a-z]+/[A-Za-z0-9-]{8,}' \
        -e '(docs|drive)\.google\.com/'
}

check_file_name() {
    case $(basename "$1") in
        .DS_Store | .env | .env.* | *.pem | *.key | *.p12 | *.keystore | id_rsa* | id_ed25519*)
            printf 'sensitive-file-name\t%s\n' "$1" >> "$findings"
            ;;
    esac
}

# Reads index paths on standard input. Submodule entries are not blobs and are skipped.
scan_index_paths() {
    while IFS= read -r index_path; do
        [ "$(git cat-file -t ":$index_path" 2>/dev/null)" = blob ] || continue
        check_file_name "$index_path"
        git show ":$index_path" > "$scanned_content"
        scan_content "$index_path"
    done
}

case ${1:-} in
    '')
        git -c core.quotepath=off diff --cached --name-only --diff-filter=ACMR | scan_index_paths
        ;;
    --tracked)
        git -c core.quotepath=off ls-files | scan_index_paths
        ;;
    --message)
        [ -f "${2:-}" ] || { echo "usage: $0 --message <file>" >&2; exit 2; }
        grep -v '^#' "$2" > "$scanned_content"
        scan_content 'commit message'
        ;;
    *)
        echo "usage: $0 [--tracked | --message <file>]" >&2
        exit 2
        ;;
esac

if [ -f .commit-privacy-allowlist ]; then
    grep -v -e '^#' -e '^[[:space:]]*$' .commit-privacy-allowlist > "$allowed_texts"
else
    : > "$allowed_texts"
fi

if [ -s "$allowed_texts" ]; then
    grep -v -F -f "$allowed_texts" "$findings" > "$unreviewed_findings"
else
    cp "$findings" "$unreviewed_findings"
fi

if [ -s "$unreviewed_findings" ]; then
    {
        echo 'Commit blocked by the privacy check. Findings (kind, then file:line:text):'
        cat "$unreviewed_findings"
        echo 'Remove each one, or after reviewing it add its exact text to .commit-privacy-allowlist.'
    } >&2
    exit 1
fi
