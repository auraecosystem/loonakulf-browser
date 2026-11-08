nix build .#frontend
chmod -R u+w frontend/dist 2>/dev/null; rm -rf frontend/dist && mkdir -p frontend/dist && cp -RL --no-preserve=mode ./result/* ./frontend/dist/

env \
  NIXOS_CHANNELS="$(cat "$(nix build --no-link --print-out-paths .#nixosChannelsJson)")" \
  AUTOCOMPLETE_OUT_DIR=./dist/autocomplete \
  nix develop -c npm --prefix=frontend run build:autocomplete

nix develop -c npm --prefix=frontend run preview
