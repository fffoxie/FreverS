# Create PAPK — how the client is redirected, and what was measured

PAPK is the original `Frever_4.0.5_APKPure.apk` with (a) the five API host
literals rewritten to this phone's address and (b) the manifest flag that allows
cleartext HTTP. Everything else — code, resources, native libraries — is the
original, rebuilt and re-signed with a keystore FreverS generates locally.

## 1. Measured string layout (this is the part the task asked to measure)

`assets/bin/Data/Managed/Metadata/global-metadata.dat`, 27,295,144 bytes,
magic `0xfab11baf` (metadata version 29):

| Item | Value |
| --- | --- |
| string-literal table offset / size | 256 / 258,680 bytes (32,335 entries, 8 bytes each) |
| literal data blob offset / size | 258,936 / 959,000 bytes |

Each table entry is **`{ uint32 length, uint32 dataOffset }`**; the text in the
data blob has **no length prefix**. Measured entries:

| Entry | Literal | Offset in file | Length |
| --- | --- | --- | --- |
| 26665 | `https://content-prod-us.frever-api.com/` | 1,072,069 | 39 |
| 26666 | `https://content-prod.frever-api.com/` | 1,072,108 | 36 |
| 26667 | `https://content-stage.frever-api.com/` | 1,072,144 | 37 |
| 26668 | `https://content-test.frever-api.com/` | 1,072,181 | 36 |
| 26669 | `https://dev.frever-api.com/` | 1,072,217 | 27 |

The literals are packed back-to-back in the blob with no slack, so a **longer**
replacement cannot be written in place (it would overwrite the next literal and
the following metadata section). A **shorter or equal-length** replacement is
safe: the text is overwritten, the entry's length field is updated, and every
other offset in the file stays valid. That is exactly what
`scripts/patch-metadata.mjs` does.

Consequence: the target URL must be **at most 36 characters** for the production
environment and **at most 27** for the develop environment
(`http://192.168.1.42:8080/` is 25). PAPK refuses anything longer and stops at
step `check-target-url` instead of producing a broken APK.

## 2. Why the manifest is patched too

`targetSdkVersion` is 34 and there is no `networkSecurityConfig` and no
`usesCleartextTraffic` in the original manifest, so Android blocks plain HTTP.
PAPK adds `android:usesCleartextTraffic="true"` to `<application>`.

No certificate pinning exists in the app (see `docs/analysis.md` §8), so no CA
installation or pin bypass is needed — and the FreverS server never disables or
bypasses certificate checks; it simply speaks HTTP on the port you choose.

## 3. Steps performed (each one is logged)

`data/logs/papk.log` and `data/papk-status.json` record every step; the first
failure stops the run and **no APK is written to `output/`**.

1. `locate-original-apk` — `analysis/Frever_4.0.5_APKPure.apk` must exist and its
   MD5 must be `c53f40eb25c8738538981ac923871917`.
2. `check-target-url` — `http://host[:port]/`, ≤ 36 characters.
3. `check-tools` — `apktool`, `apksigner`, `keytool`, `java` from `PATH`
   (Termux) or from `analysis/tools/` (PC fallback).
4. `apktool-decode` — `apktool d -s` (keeps the original dex files untouched).
5. `patch-metadata-hosts` — rewrites the five literals as described above.
6. `patch-manifest-cleartext` — adds `android:usesCleartextTraffic="true"`.
7. `apktool-build` — rebuilds the APK.
8. `keystore` — creates `~/.frevers/frevers.keystore` (password in
   `~/.frevers/keystore.pass`, mode 600) on first run; reused afterwards. Never
   inside the repository.
9. `sign` — `apksigner` (Termux) or uber-apk-signer (PC fallback).
10. `md5` — records the size and MD5 shown on the dashboard.

## 4. Verified run (PC, x86_64, JDK 17, apktool 2.9.3)

```
ok      locate-original-apk  .../analysis/Frever_4.0.5_APKPure.apk md5=c53f40eb25c8738538981ac923871917
ok      check-target-url     http://127.0.0.1:8090/ (22 chars; production literal 36)
ok      apktool-decode       .../analysis/papk-work/decoded
ok      patch-metadata-hosts all five hosts patched
ok      patch-manifest-cleartext android:usesCleartextTraffic=true
ok      apktool-build        217056634 bytes
ok      keystore             generated /home/.../.frevers/frevers.keystore
ok      sign                 output/Frever_4.0.5_FreverS.apk
ok      md5                  f4b796428f6c922477b794e126c32400 217326680 bytes
```

Checked afterwards on the produced file:

- `apksigner`-compatible verify (uber-apk-signer): `zipalign verified`,
  `signature verified [v3]`.
- `global-metadata.dat` inside the APK: 5 × `http://127.0.0.1:8090/`,
  0 × `content-prod.frever-api.com/`, size unchanged (27,295,144 bytes).
- Re-decoded manifest: `android:usesCleartextTraffic="true"`,
  `debuggable="false"`.
- The dashboard served the file as `application/vnd.android.package-archive`,
  and the downloaded copy's MD5 equalled the one shown on the page.

**The APK was not installed or run on an Android device in this environment.**
Nothing here proves that the game starts against FreverS; see `docs/status.md`.

A second run through the dashboard button, targeting
`http://192.168.1.42:8080/`, produced MD5 `50bf3c97a4e9448eff77b5095447b7b1`
(same size). The MD5 differs per build because signing embeds timestamps — that
is why the dashboard always shows the hash of the file it just wrote.

## 5. Termux

`pkg install apktool apksigner openjdk-21` provides everything. Termux's apktool
package (3.0.3, depends `openjdk-21, aapt2`) ships a launcher in `$PREFIX/bin`
and a patch that forces it to use Termux's native `aapt2`, which is what makes an
on-device rebuild plausible. The signing package installs
`$PREFIX/bin/apksigner`.

**This was not executed on a device**: there was no Android/Termux environment in
this run, so Create PAPK on the phone is **unverified**. If it fails, the
dashboard shows the exact failing step (`check-tools`, `apktool-decode`,
`apktool-build`, `sign`, …) and the message.

## 6. Fallback: build the PAPK on a PC

Same script, same steps, no device needed:

```bash
# one-time: a JRE plus the two jars
mkdir -p analysis/tools && cd analysis/tools
curl -L -o jdk.tgz 'https://api.adoptium.net/v3/binary/latest/17/ga/linux/x64/jre/hotspot/normal/eclipse'
mkdir jre && tar xzf jdk.tgz -C jre --strip-components=1
curl -L -o apktool.jar 'https://github.com/iBotPeaches/Apktool/releases/download/v2.9.3/apktool_2.9.3.jar'
curl -L -o signer.jar 'https://github.com/patrickfav/uber-apk-signer/releases/download/v1.3.0/uber-apk-signer-1.3.0.jar'
cd ../..

cp /path/to/Frever_4.0.5_APKPure.apk analysis/
export PATH="$PWD/analysis/tools/jre/bin:$PATH"
node scripts/papk.mjs --url http://<phone-lan-ip>:8080/
```

Or click **Create PAPK** on the dashboard running on the PC. Install
`output/Frever_4.0.5_FreverS.apk` on the phone; the game will then talk to
`http://<phone-lan-ip>:8080/`, so the PC must keep the server running.
