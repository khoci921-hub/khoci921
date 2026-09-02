# PWA FCM Badge & Ikon Notifikasi ASJ

## Tujuan

Membuat push notification ASJ lebih mudah dikenali di Android tanpa menyimpan
status baca atau jumlah notifikasi di server.

## Keputusan

- Setiap FCM push dikirim sebagai _data message_ (`title`, `body`, `url`),
  bukan payload `notification` yang ditampilkan otomatis oleh FCM.
- Service worker yang menampilkan notifikasi. Saat menerima pesan di latar
  belakang, ia menyalakan app badge bernilai `1` jika Badging API tersedia.
- Badge aplikasi dibersihkan saat halaman portal terbuka atau kembali aktif.
  Tidak ada tabel, API, polling, atau counter server.
- `icons/notification-badge.png` menjadi ikon kecil notifikasi: transparan
  dengan emblem ASJ putih. Android membatasi ikon status menjadi monokrom;
  ikon ASJ berwarna yang sudah ada tetap menjadi gambar besar notifikasi.
- Pemberitahuan di depan layar tetap berupa toast dan tidak menyalakan badge,
  sebab pengguna sudah sedang berada di portal.

## Alur

1. Backend mengirim data FCM ke token terdaftar.
2. Service worker menerima pesan latar belakang, memanggil
   `navigator.setAppBadge(1)`, lalu menampilkan notifikasi dengan ikon ASJ.
3. Pengguna membuka portal melalui notifikasi atau ikon aplikasi.
4. Halaman memanggil `navigator.clearAppBadge()` secara aman.

## Batasan Platform

- Badging API tidak menjamin tampilan angka di Android; launcher dapat memilih
  titik merah saja.
- App badge umumnya membutuhkan PWA yang sudah dipasang. Jika API tidak
  tersedia, notifikasi tetap tampil tanpa badge.
- Ikon status Android tidak dapat memaksa logo berwarna; aset badge dibuat
  monokrom agar tidak lagi terlihat sebagai kotak putih penuh.

## Berkas yang Berubah

- `netlify/functions/_lib/fcm-server.ts`: payload FCM data-only.
- `sw.js`: render notifikasi, set badge, dan navigasi klik.
- `js/fcm-client.ts`: tetap menampilkan toast untuk pesan foreground yang
  kini menggunakan `payload.data`.
- `pwa.ts`: menghapus app badge saat portal digunakan.
- `icons/notification-badge.png`: lambang ASJ monokrom transparan.
- Tes unit untuk payload FCM dan perilaku pemrosesan data notifikasi.

## Verifikasi

- Tes unit memastikan payload mengandung data string dan tidak lagi memiliki
  `message.notification`.
- Build lengkap dan pemeriksaan tipe harus lulus.
- Tes nyata mengirim satu FCM ke token Khoci dan pengguna mengonfirmasi
  notifikasi tampil, emblem status berubah, serta badge hilang saat portal
  dibuka.
