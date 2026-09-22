{
  description = "salsaapp dev shell (SvelteKit + SQLite + deploy tooling)";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-25.11";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = [
            # App toolchain. Node 22 matches the systemd unit on the server
            # (nixos-config modules/services/salsa.nix) — keep them in step.
            pkgs.nodejs_22

            # The database is a file; the CLI is for poking at it and for the
            # same `.backup` command the server's backup timer runs.
            pkgs.sqlite

            # better-sqlite3 falls back to a source build when no prebuilt
            # binary matches; these make that fallback work instead of failing.
            pkgs.python3
            pkgs.gcc
            pkgs.gnumake

            # Deploy tooling — deploy.sh shells out to all of these.
            pkgs.rsync
            pkgs.openssh
            pkgs.curl

            # CLI / agent QoL
            pkgs.jq
            pkgs.ripgrep
            pkgs.fd

            # Editor LSPs
            pkgs.nodePackages.typescript-language-server
            pkgs.tailwindcss-language-server
            pkgs.vscode-langservers-extracted
          ];

          shellHook = ''
            # Local data lives in the repo (gitignored), same layout as
            # /var/lib/salsa on the server: salsa.db beside recordings/.
            export DATA_DIR="$PWD/.data"
            export DATABASE_PATH="$DATA_DIR/salsa.db"
            mkdir -p "$DATA_DIR/recordings"

            echo "salsaapp dev shell — node $(node --version), sqlite $(sqlite3 --version | awk '{print $1}')"
            echo "  npm run dev"
          '';
        };
      }
    );
}
