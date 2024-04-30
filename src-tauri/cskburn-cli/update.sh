#!/bin/bash
set -e

shdir=$(dirname $(realpath $0))
ver=$1

if [ -z $ver ]; then
    echo "Usage: $0 <version>"
    exit 1
fi

echo "Updating cskburn-cli to $ver"

base_url="https://github.com/LISTENAI/cskburn/releases/download/${ver}"

echo "Downloading cskburn-win32-x64"
wget -q --show-progress "${base_url}/cskburn-win32-x64.zip" -O $shdir/cskburn-win32-x64.zip
unzip -o $shdir/cskburn-win32-x64.zip -d $shdir
mv $shdir/cskburn.exe $shdir/cskburn-x86_64-pc-windows-msvc.exe
rm $shdir/cskburn-win32-x64.zip

echo "Downloading cskburn-linux-x64"
wget -q --show-progress "${base_url}/cskburn-linux-x64.tar.xz" -O $shdir/cskburn-linux-x64.tar.xz
tar -xJf $shdir/cskburn-linux-x64.tar.xz -C $shdir
mv $shdir/cskburn $shdir/cskburn-x86_64-unknown-linux-gnu
rm $shdir/cskburn-linux-x64.tar.xz

echo "Downloading cskburn-darwin-x64"
wget -q --show-progress "${base_url}/cskburn-darwin-x64.tar.xz" -O $shdir/cskburn-darwin-x64.tar.xz
tar -xJf $shdir/cskburn-darwin-x64.tar.xz -C $shdir
mv $shdir/cskburn $shdir/cskburn-x86_64-apple-darwin
rm $shdir/cskburn-darwin-x64.tar.xz

echo "Downloading cskburn-darwin-arm64"
wget -q --show-progress "${base_url}/cskburn-darwin-arm64.tar.xz" -O $shdir/cskburn-darwin-arm64.tar.xz
tar -xJf $shdir/cskburn-darwin-arm64.tar.xz -C $shdir
mv $shdir/cskburn $shdir/cskburn-aarch64-apple-darwin
rm $shdir/cskburn-darwin-arm64.tar.xz
