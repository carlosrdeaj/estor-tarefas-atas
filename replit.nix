{ pkgs }: {
  deps = [
    pkgs.nodejs_20
    pkgs.sqlite
    pkgs.python3
    pkgs.gcc
    pkgs.gnumake
    pkgs.pkg-config
  ];
}
