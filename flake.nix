{
  description = "salsaapp dev shell (SvelteKit + SQLite + deploy tooling)";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-25.11";
    nixpkgs-unstable.url = "github:nixos/nixpkgs?ref=nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, nixpkgs-unstable, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };

        # yt-dlp only: YouTube breaks old releases within weeks, and the stable
        # channel lags by months. Used as a binary, so its Python never meets
        # the worker's (torch) Python.
        unstable = import nixpkgs-unstable { inherit system; };
        py = pkgs.python3Packages;

        beat-this = py.buildPythonPackage {
          pname = "beat-this";
          version = "1.1.0";
          pyproject = true;
          src = pkgs.fetchFromGitHub {
            owner = "CPJKU";
            repo = "beat_this";
            rev = "b95c8ab0c58c2d9fcfd40508ae8dffbc05ac4f5c";
            hash = "sha256-bya9HP7oCq4AnTSKOkMfPnzVLlHnFhwH24AkgtlaB8Y=";
          };
          build-system = [ py.setuptools ];
          dependencies = with py; [
            numpy
            torch
            torchaudio
            einops
            rotary-embedding-torch
            soxr
            # Its audio loader falls back through madmom and torchcodec; soundfile
            # is the one that reads the WAV the worker hands it.
            soundfile
          ];
          doCheck = false;
          pythonImportsCheck = [ "beat_this.inference" ];
        };

        # Pinned model weights, so the worker never downloads at runtime (and a
        # DynamicUser service has nowhere sensible to cache them anyway).
        beat-this-checkpoint = pkgs.fetchurl {
          url = "https://cloud.cp.jku.at/public.php/dav/files/7ik4RrBKTS273gp/final0.ckpt";
          hash = "sha256-jDKLRfWdjdPf8hklP/ao1kgr5X0BM6KRQOL+u/jrgzE=";
        };

        salsa-worker = py.buildPythonApplication {
          pname = "salsa-worker";
          version = "0.1.0";
          pyproject = true;
          src = ./worker;
          build-system = [ py.setuptools ];
          dependencies = [ beat-this ];
          nativeCheckInputs = [ py.pytestCheckHook ];
          makeWrapperArgs = [
            "--prefix" "PATH" ":" (pkgs.lib.makeBinPath [ pkgs.ffmpeg-headless unstable.yt-dlp ])
            "--set-default" "BEAT_THIS_CHECKPOINT" "${beat-this-checkpoint}"
          ];
        };
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

        packages = {
          inherit beat-this beat-this-checkpoint salsa-worker;
          default = salsa-worker;
        };
        # Building the package runs the worker's pytest suite.
        checks.worker = salsa-worker;
      }
    );
}
