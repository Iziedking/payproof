#!/usr/bin/env bash
# Installs the pinned Yosys (YoWASP build of Yosys 0.70) into ./tools without pip.
# Runs inside the throwaway workdir on the build or test host. Nothing is written
# outside the current directory: the YoWASP compile cache goes to ./cache.
#
# Sources (read 2026-11-17 from https://pypi.org/pypi/<name>/<version>/json):
#   yowasp-yosys 0.70.0.0.post1259 requires yowasp-runtime~=1.12, click
#   yowasp-runtime 1.96 requires platformdirs>=3,<5 and wasmtime>=44,<48
#   wasmtime 47.0.1 (newest release below 48)
# Yosys 0.70 is the pin in VERSIONS.md (released 2026-10-13).
# The wheel has no standalone yosys-abc: ABC is linked inside yosys.wasm and is
# reached through the Yosys `abc` pass. Entry point read from the wheel's
# entry_points.txt: yowasp-yosys = yowasp_yosys:_run_yosys_argv.
set -euo pipefail

mkdir -p tools/wheels tools/pylib cache
cd tools/wheels

fetch() { # url sha256
  local url="$1" sum="$2" file
  file="${url##*/}"
  if [ ! -f "$file" ]; then curl -fsSL --retry 3 -o "$file" "$url"; fi
  echo "$sum  $file" | sha256sum -c -
}

fetch https://files.pythonhosted.org/packages/eb/0d/baff1eec0c9e25afbde50e6cdc4c5d748fea04828faa4655e67cc281625a/yowasp_yosys-0.70.0.0.post1259-py3-none-any.whl 38a5ce6af95045b5b1ad795de7a73cfe88cf70c19f7b95f027f4a377a85310c0
fetch https://files.pythonhosted.org/packages/92/e2/4dd5c8392a3f085f5ba81b5a4ac5f59923a0c3b36a35351975d8d7de19c9/yowasp_runtime-1.96-py3-none-any.whl 4ff456a4a6dff9d689c7feac9f68fb1492bed4cf873450d7b41259fa31645783
fetch https://files.pythonhosted.org/packages/5e/ba/f321faaad1d616b94fe70a62ebb7e4054cfe41a6a46aa796ad2bb07fa08c/wasmtime-47.0.1-py3-none-manylinux1_x86_64.whl 9724600b036c6e95c4fe952e29fad83b4f02bdc11d23f25c4ee3ffff2c1d7257
fetch https://files.pythonhosted.org/packages/7c/ae/ecbbbfd0e4343a6a521d49b3c8656fb4643dee2a4f6eaf941cf3280391a8/platformdirs-4.14.5-py3-none-any.whl 8e778c6fa421516f4d3369449f8df3b0e1b72c0e0005fe88e3ec772d0a14e750
fetch https://files.pythonhosted.org/packages/31/7d/164b7ffc8624fe9efb4221bf9af485d5c1e41b9ae118045d2b6dc5457d8b/click-8.5.1-py3-none-any.whl 8bb5376d2006950386f8c6427613334a2acadc5f559cb80e638d00b4df957e37

for w in *.whl; do python3 -m zipfile -e "$w" ../pylib/; done
cd ../..

cat > tools/yosys <<'EOF'
#!/usr/bin/env bash
here="$(cd "$(dirname "$0")" && pwd)"
export PYTHONPATH="$here/pylib" XDG_CACHE_HOME="$here/../cache" YOWASP_CACHE_DIR="$here/../cache"
exec python3 -c 'import sys, yowasp_yosys; sys.exit(yowasp_yosys._run_yosys_argv())' "$@"
EOF
chmod +x tools/yosys
tools/yosys -V
