<?php
// Tentukan folder tujuan
$dir = "stockid_gambar/gain/";
$images = [];

if (is_dir($dir)) {
    // Membaca semua file gambar (jpg, jpeg, png, webp)
    $files = glob($dir . "*.{jpg,jpeg,png,webp,gif}", GLOB_BRACE);
    foreach ($files as $file) {
        $images[] = basename($file);
    }
}

header('Content-Type: application/json');
echo json_encode($images);
?>