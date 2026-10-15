/** The ratorio save each golden build was taken from, by golden build name. */
export const goldenSaveUrlOf = {
    "mechanic-arms-cannon":
        "https://roratorio-hub.github.io/ratorio/ro4/m/calcx.html?dxKLUv_WBrBI0WAIarlTcwq-rAMp4RERGwdXzTBd_A6RqqQSrzte3ev-2f99S9ptL_2f_3f_79b_87QhEraUu2HkJDQUEcfQCGAIoA5_Ve16NsXXdGc0ZDGSUzPLr-0XPfMF2S3FZmm2Pa69HzXR93tr5aci1Sn820F0sY4FaSpLET-QShFP2cOb6l-9ryfk5m_pfnGyl9fWnczVwStK-tcUm5Lx2fsEzyXPYcLlUfzq9Rfbu-02XDs0RCbS37p_5xtwSs0yVLayFfh4qceEV5uhAF9EyTsPMeMAazx80pR1j1MaKcKFtJrFhAUgifKBqDFnDSDYhgJ3ab0SRSwNhsS6yIfE9RtmmMy-_gv2kYZ30KLp_1eV_StD4OBMzxBwLWx13Pklytz8LbkqBuOazH3tOfdDJz_k3HMtmFZfqW8lS7ntLLS-cH-84Yvz7SA-amBYw0loJOqQC6ZKyHAkLLciTj871oA3NEaXXkciEm-VCMyE0wtZaTt8QbqHwgp3Qla8dpAx6fweWCsbBn6eHJtnogKvVMvJvbQm663mJTKHY646XTeQNOU4E20DwYejCeC9y1JlUzbKuhBFGj2dintW3pwhCF340CfwjXxckbZ7ixs1lUzvNjFikrhZA6S-07Ok0zBOp4pNO5QbWCUK0YVCsH1YriYjVxsbK4WP32vv2_n2sHx3jmFBQYDwwbn_NjRyKadmi6QiKjIkLj9E3cUNydIpEuyxmgZVfWa0-zZcu44111pKyPJ7I9xDtoBZ0lyOZRbt7jIVMJMTGOCq_iZFPCIVzBpCzpZRaS-brvM1W-SRgyKJAkGDtSB6EpJSQxJEkoMf8p1R0kxQWQCuJINbhPRGRKjUqLX0vJ1Ot_AsVPAz3v7mawGkPUcVB5KPRrLjYlVlNJUO_QGUWDAQES3lbwAgKxAGBcsL5nVmOx1cgZJVjFPZIkLnrFRalKL6Fwo_xxMD5Y23FChwI",
    "mechanic-arms-cannon-soul-cannonball":
        "https://roratorio-hub.github.io/ratorio/ro4/m/calcx.html?dxKLUv_SD0FQYAEg4sHzBzGzDbn5tt0ylsxGRzhG_6TCF6yVpyi-JcBwYGpQKfqtJYAZa5QPkMwLjx45eXr05klxv_BHZti4_ay4iflAnfEMVVsruxlAe__xoLviOUXoTctYgb8mDBU5d0jT2_EdIVRiaUq9TznXuU63N2cJ2Co3dR3Br1fJ_SFer5GChdvecvQ3LOELm1ez4_CB2ahbLWskOiKt7lnv-0MGEqiUlzzXepcOeZ8yzAJgyMzBMFCHA-oYNalqsxszAaFQU",
    "arch-mage-frozen-slash":
        "https://roratorio-hub.github.io/ratorio/ro4/m/calcx.html?dxKLUv_WBFAO0HADZRNx8gsw6YzX8-P2HPxOR-NZ9AwEa6ePu7IkIdMiQIIMhNLwAtAC4ADrViSJQyQ_f30eFatYSSH6a2qtvfq1ZVQvJV7niKDSVanOBt55fzUAC6MNKCPAEYqidnCBvlFnxmqzppr2tybkdSf59R61HkOqVwPXnyZRqECL4Ym8Bcm-uyzTmqHtzGuGgHrz9xW5KaLOgSx21JZAWvhZ42hURd8CWhrMle5wqmGCTs-GJh6fcLn23TVAJQppPZQwBoeSO_Gh6o7uN5WoWmyo23otatfhXDoi38FS3h4bZt01U9DigAwxYOUO0BqHlfLrmqa589gfDaFCGtiPm99KE",
    "summoner-carrot-beat":
        "https://roratorio-hub.github.io/ratorio/ro4/m/calcx.html?cx1cy1sv8uqmqOquoq.8cz11.32hxm36cz12.32jQo2V3cz13003MjUiDOIfDyM8cz14.4h85cz15.4hU7cz160032jun3ytAp-cz17003OjBBk3xikhxi9bcz18003OjAtjQwhl4xx7acz19003_dGD3ugzesUwK7F3iT3cz1a003_dGE3ugzesUwK7F3iT3cz1b.4hM1cz1c.4hOacA1Z_1127456b89a3cA128c0cC1.ecD1.fxc11h613cG1.eg.34cK102.bcR2.5w1cW1005Wl1cZ121",
} as const;

/** A save made on the original page, with the damage the page showed for it where that was noted. */
export interface SaveMadeOnTheOriginal {
    readonly url: string;
    readonly shownByThePage?: { readonly averageDamagePerAttack: number; readonly averageDamagePerSecond: number };
}

/**
 * Every save here was made on the original page through its own controls, so
 * every value in it is one the original offered. A save needs no reference
 * fixture to be listed: add one from a job or a feature the others do not
 * cover. scripts/drive-original-page.browser.js helps making one.
 */
export const savesMadeOnTheOriginal: Readonly<Record<string, SaveMadeOnTheOriginal>> = {
    ...Object.fromEntries(Object.entries(goldenSaveUrlOf).map(([name, url]) => [name, { url }])),
    // Fourth job with trait stats, a bow with random options at positions 1 and 3, a fire arrow, a shadow weapon with an option.
    "wind-hawk-bow-arrow-random-options-shadow": {
        url: "https://roratorio-hub.github.io/ratorio/ro4/m/calcx.html?dxKLUv_SDdLQUAIgsjGVB5A9CRIEtxv6S_ESKZKpPJ3lNcyMzMygfldX2YMT0OUz-BWbE777fbm2_GL63LS9SR76htP1EhXBBQcIcquH0cP942A9akaqH7IQFjryCwweanCr9UsPmf8EsDm78a_NJr80vXL7U2f_WgCpYvG9SIt9v83VPYXbXONO-rtaZ4oY_v4k9jSh2GJhkLKIAZeNB4HiJJ99eYkXYcnbKumIwC",
        shownByThePage: { averageDamagePerAttack: 127, averageDamagePerSecond: 337 },
    },
    // Gunslinger line: a +10 rifle transcended twice, a bullet, a wind endow.
    "night-watch-rifle-bullet-endow": {
        url: "https://roratorio-hub.github.io/ratorio/ro4/m/calcx.html?dxKLUv_SDBpQQA0kkfGVB3DjCb354vKvfwp3Rp426EO-4YOJmZKRMjhnnZIbvNVi0Bee9Rnyk91NQ5z6DpnkyfNO0iqJM1iklgIhhepejINFjbGVmREfV2ZZznUG93cZ5CvX0R58n1NsXnWett61kmSj_6ept6yMeT6bTT_xtf5WEfbHlIirOTFAMKKIAZeDA3DmG5GBtCByv8VdXSGQ",
        shownByThePage: { averageDamagePerAttack: 189, averageDamagePerSecond: 185 },
    },
    // An adopted third job with guild skills and gospel, food and consumables, a pet and a login bonus.
    "rune-knight-adopted-guild-item-other-buffs": {
        url: "https://roratorio-hub.github.io/ratorio/ro4/m/calcx.html?dxKLUv_SDjLQUA8okgGVB5A3qtpUC2k_5GO1ZBOsqssL1rTGZmVj4lhn0aMT1uVz-B6dah91urP18dv9Q2TzGf9e06XwoamHryXnEVH_lrvYL5aurH1882kLbOEr6DFTyIIC8kYW9P66zlodLCZ2wNd7p-aWAXR7rUg_Ez_bDNq2OvKtnl4nv4k5hTt6VJBhUocMPYGsAbA5kUWQJV69aFmeQeKzDWCpy1EkR5_38C",
        shownByThePage: { averageDamagePerAttack: 52, averageDamagePerSecond: 77 },
    },
    // Third job without trait stats, a dagger in each hand, a poison endow.
    "guillotine-cross-two-daggers-endow": {
        url: "https://roratorio-hub.github.io/ratorio/ro4/m/calcx.html?dxKLUv_SDIxQQAQkogGWB5A7C_aSrKh-S7MwsE3PF7005OgEEQFAcfRWlVAbOrQg8B2LKb78nczPPSM0rlP1Lu4_kH6bYSg6VTkEG707Rhg1ozohoqwe9DRM8Y-P0fekbq9yWhZ5x-_5k9o_t9Sg2fUfr9Kkos88bt94XY3N38WJqGVFN339zDAj5YtdALCiiAGXgwNw5huRgbQgcr_HHV0hk",
        shownByThePage: { averageDamagePerAttack: 29, averageDamagePerSecond: 82 },
    },
};
