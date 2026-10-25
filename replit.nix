{ pkgs }: {
  deps = [
    pkgs.sqlite
    pkgs.python3
    pkgs.gcc
    pkgs.gnumake
    pkgs.pkg-config
  ];
}
