/**
 * RentLeaks — Flexible housing product
 * Search, match, compare, apply, list — driven by data.js
 */
(function () {
  /* The RentLeaks logo: the line-art phone-and-house mark beside the script
     wordmark, from brand/rentleaks-logo.pdf. One colour, inheriting
     currentColor, so the header and the dark footer are both right without
     a second file. */
  const RL_LOGO = '<svg class="logo__lockup" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="118.5 455.5 1033.0 289.0" fill="currentColor" aria-hidden="true" focusable="false"><defs><path id="font_1_1" d="M.781 .5512C.781 .5192 .7738 .489 .7595 .4606 .7452 .4322 .7253 .4069 .7 .3845 .6747 .3622 .645 .3433 .611 .328 .577 .3126 .54 .3023 .5 .297 .51 .2669 .5222 .2359 .5365 .2041 .5508 .1723 .5663 .1417 .583 .1123 .5997 .0829 .617 .0558 .635 .031 .653 .0062 .6707-.0142 .688-.0302 .6847-.0368 .6798-.0434 .6735-.0499 .6672-.0565 .6598-.0626 .6515-.0682 .6432-.0738 .6345-.0784 .6255-.082 .6165-.0856 .608-.0874 .6-.0874 .5853-.0874 .5713-.0804 .558-.0664 .5447-.0524 .5312-.0302 .5175 .0002 .5038 .0305 .4895 .0699 .4745 .1183 .4595 .1667 .443 .2249 .425 .293 .4177 .293 .4103 .293 .403 .293 .3957 .293 .39 .2936 .386 .295 .3813 .2976 .3763 .3023 .371 .309 .353 .2703 .337 .2339 .323 .1999 .309 .1658 .2965 .1329 .2855 .1012 .2745 .0695 .2648 .0388 .2565 .0091 .2482-.0206 .241-.0508 .235-.0815 .2123-.0762 .1927-.0667 .176-.0529 .1593-.0391 .1437-.0197 .129 .0052 .1317 .0112 .1345 .017 .1375 .0227 .1405 .0283 .1443 .0363 .149 .0466 .1537 .0569 .1595 .0701 .1665 .086 .1735 .102 .1828 .1233 .1945 .1499 .2062 .1764 .2202 .209 .2365 .2476 .2528 .2862 .2727 .333 .296 .3882 .3067 .4128 .3158 .4344 .3235 .453 .3312 .4716 .338 .4894 .344 .5064 .35 .5233 .3555 .5403 .3605 .5572 .3655 .5742 .3707 .5936 .376 .6156 .3453 .6051 .3168 .5934 .2905 .5806 .2642 .5678 .2423 .5542 .225 .5397 .219 .5438 .2128 .5498 .2065 .558 .2002 .5661 .1943 .575 .189 .5848 .1837 .5946 .179 .6046 .175 .6147 .171 .6248 .1687 .634 .168 .6421 .188 .6556 .2125 .6681 .2415 .6796 .2705 .6911 .3013 .701 .334 .7095 .3667 .7179 .4 .7245 .434 .7292 .468 .734 .4997 .7363 .529 .7363 .609 .7363 .671 .7198 .715 .6868 .759 .6538 .781 .6086 .781 .5512M.537 .6313C.5323 .6254 .525 .6136 .515 .5959 .505 .5781 .4935 .5569 .4805 .5323 .4675 .5076 .4538 .4809 .4395 .452 .4252 .4231 .4113 .3945 .398 .3662 .448 .3662 .494 .3709 .536 .3802 .578 .3895 .6143 .4027 .645 .4197 .6757 .4367 .6995 .4567 .7165 .4797 .7335 .5027 .742 .5282 .742 .5562 .742 .5895 .73 .615 .706 .6327 .682 .6503 .645 .6592 .595 .6592 .5837 .6592 .5723 .6583 .561 .6564 .5497 .6546 .5377 .6525 .525 .6501L.537 .6313Z"/><path id="font_1_2" d="M.455 .408C.4523 .3672 .445 .3322 .433 .303 .421 .2737 .4038 .2481 .3815 .2261 .3592 .2041 .332 .1842 .3 .1665 .268 .1487 .2307 .1316 .188 .1152 .188 .1113 .1878 .1072 .1875 .1029 .1872 .0986 .187 .0942 .187 .0896 .187 .0811 .1877 .0722 .189 .063 .1903 .0538 .1927 .0452 .196 .0374 .1993 .0295 .204 .0231 .21 .0181 .216 .0132 .2237 .0107 .233 .0107 .251 .0107 .2687 .0147 .286 .0226 .3033 .0305 .3198 .0401 .3355 .0516 .3512 .0631 .3658 .0756 .3795 .0891 .3932 .1026 .4053 .1149 .416 .1261 .4227 .1201 .4283 .1146 .433 .1093 .403 .0697 .3702 .0368 .3345 .0107 .2988-.0154 .265-.032 .233-.0393 .187-.034 .1512-.0171 .1255 .0112 .0998 .0396 .087 .0738 .087 .1138 .087 .1412 .0908 .1691 .0985 .1974 .1062 .2258 .1168 .2531 .1305 .2795 .1442 .3059 .1602 .3307 .1785 .3541 .1968 .3774 .2165 .3978 .2375 .4151 .2585 .4325 .2802 .4462 .3025 .4562 .3248 .4662 .347 .4712 .369 .4712 .3997 .4668 .4283 .4457 .455 .408M.386 .3754C.368 .3728 .3493 .3656 .33 .3538 .3107 .3419 .2925 .3262 .2755 .3064 .2585 .2867 .243 .2637 .229 .2374 .215 .2112 .204 .1829 .196 .1527 .2493 .179 .2937 .2113 .329 .2498 .3643 .2882 .3833 .3301 .386 .3754Z"/><path id="font_1_3" d="M.259 .486C.2763 .4806 .2927 .4687 .308 .4503 .3233 .4319 .3347 .4116 .342 .3895 .3347 .3715 .3233 .3497 .308 .3243 .2927 .2988 .2773 .2729 .262 .2464 .2467 .22 .2328 .1949 .2205 .1711 .2082 .1474 .201 .1278 .199 .1124 .2097 .1238 .2215 .137 .2345 .1521 .2475 .1672 .2602 .1822 .2725 .1973 .2848 .2124 .2963 .2261 .307 .2385 .3177 .2509 .326 .2601 .332 .2661 .3447 .2796 .3597 .2951 .377 .3129 .3943 .3306 .4125 .3474 .4315 .3631 .4505 .3789 .4697 .3923 .489 .4033 .5083 .4144 .526 .4199 .542 .4199 .5593 .4199 .5738 .414 .5855 .4023 .5972 .3905 .6063 .3783 .613 .3655 .613 .3642 .6105 .3623 .6055 .36 .6005 .3577 .5933 .3512 .584 .3405 .5747 .3285 .5642 .312 .5525 .291 .5408 .27 .5295 .2474 .5185 .223 .5075 .1987 .4983 .1739 .491 .1485 .4837 .1232 .48 .1002 .48 .0795 .48 .0629 .4822 .0522 .4865 .0475 .4908 .0429 .497 .0405 .505 .0405 .5123 .0405 .52 .0422 .528 .0454 .536 .0487 .5423 .0503 .547 .0503 .5497 .049 .5518 .0461 .5535 .0418 .5552 .0375 .556 .0336 .556 .0303 .5507 .0256 .5443 .021 .537 .0163 .5297 .0116 .522 .0073 .514 .0033 .506-.0007 .4982-.0041 .4905-.0067 .4828-.0094 .476-.0107 .47-.0107 .4507-.0107 .4348-.0079 .4225-.0022 .4102 .0034 .4005 .0109 .3935 .0203 .3865 .0296 .3817 .0408 .379 .0538 .3763 .0668 .375 .0806 .375 .0953 .375 .1033 .3757 .1123 .377 .1223 .3783 .1323 .381 .1442 .385 .1578 .389 .1715 .3947 .1878 .402 .2068 .4093 .2259 .4187 .2487 .43 .2754 .4287 .2754 .4197 .2707 .403 .2614 .3863 .252 .3683 .2377 .349 .2184 .3177 .1883 .2895 .1587 .2645 .1293 .2395 .1 .214 .0673 .188 .0312 .1733 .0106 .1605-.0069 .1495-.0213 .1385-.0356 .129-.0451 .121-.0498 .107-.0418 .0967-.0306 .09-.0163 .0833-.0019 .0783 .0129 .075 .0283 .075 .041 .0768 .057 .0805 .0764 .0842 .0957 .0892 .1173 .0955 .141 .1018 .1647 .1097 .1895 .119 .2156 .1283 .2416 .1387 .2677 .15 .2937 .1753 .3525 .1985 .3985 .2195 .4319 .2405 .4653 .2537 .4833 .259 .486Z"/><path id="font_1_4" d="M.156 .3838C.1527 .3878 .1497 .3962 .147 .4091 .1443 .4221 .143 .4332 .143 .4425 .1603 .4398 .177 .4385 .193 .4385 .209 .4385 .2237 .4385 .237 .4385 .247 .4583 .2578 .478 .2695 .4976 .2812 .5171 .2925 .535 .3035 .5512 .3145 .5674 .3248 .5812 .3345 .5924 .3442 .6037 .3517 .611 .357 .6143 .3637 .6143 .3722 .6131 .3825 .6107 .3928 .6083 .4033 .6053 .414 .6015 .4247 .5978 .4343 .5939 .443 .5898 .4517 .5858 .4577 .5817 .461 .5777 .441 .5525 .4238 .5291 .4095 .5076 .3952 .4861 .3797 .4614 .363 .4336 .3763 .4336 .3898 .4336 .4035 .4336 .4172 .4336 .431 .4346 .445 .4365 .4483 .4332 .451 .429 .453 .424 .455 .4189 .456 .4138 .456 .4084 .4233 .3959 .3837 .3896 .337 .3896 .3203 .3575 .3055 .3256 .2925 .2938 .2795 .262 .2685 .2314 .2595 .2019 .2505 .1725 .2435 .1447 .2385 .1186 .2335 .0925 .231 .0691 .231 .0483 .231 .0189 .242 .0025 .264-.0009 .284 .0018 .303 .0068 .321 .0141 .339 .0215 .355 .0308 .369 .0422 .373 .0362 .3753 .0312 .376 .0272 .372 .0212 .3652 .0142 .3555 .0063 .3458-.0017 .3353-.0095 .324-.0171 .3127-.0247 .3017-.0312 .291-.0365 .2803-.0418 .2723-.0447 .267-.0454 .2503-.0454 .2337-.0421 .217-.0354 .2003-.0287 .1852-.0203 .1715-.0103 .1578-.0003 .1467 .0109 .138 .0233 .1293 .0357 .125 .0479 .125 .0599 .125 .0759 .1272 .0962 .1315 .1205 .1358 .1449 .142 .1715 .15 .2003 .158 .229 .1673 .2591 .178 .2905 .1887 .322 .2003 .353 .213 .3838H.156Z"/><path id="font_1_5" d="M.473 .0567C.4897 .028 .498 .0004 .498-.0262 .498-.0322 .4975-.0377 .4965-.0427 .4955-.0477 .4943-.0528 .493-.0582 .4817-.0565 .4698-.0557 .4575-.0557 .4452-.0557 .4323-.0557 .419-.0557 .403-.0557 .3868-.0557 .3705-.0557 .3542-.0557 .336-.0567 .316-.0589 .296-.061 .2737-.0638 .249-.0674 .2243-.0709 .1957-.0755 .163-.0812 .1477-.0759 .1323-.0653 .117-.0497 .1017-.034 .0873-.0151 .074 .0069 .0807 .0216 .089 .0398 .099 .0615 .109 .0832 .1207 .1096 .134 .1406 .1473 .1717 .1622 .208 .1785 .2498 .1948 .2915 .2123 .3398 .231 .3945 .243 .4306 .2533 .4623 .262 .4897 .2707 .517 .2785 .5436 .2855 .5693 .2925 .595 .2993 .6219 .306 .6499 .3127 .678 .32 .7104 .328 .7471 .3547 .7417 .3778 .7319 .3975 .7175 .4172 .7032 .436 .6827 .454 .656 .4487 .6473 .4417 .6333 .433 .614 .4243 .5946 .4142 .5711 .4025 .5434 .3908 .5157 .378 .4844 .364 .4494 .35 .4144 .3353 .3768 .32 .3368 .3053 .2975 .291 .2604 .277 .2258 .263 .1911 .2505 .1597 .2395 .1317 .2285 .1037 .2197 .0797 .213 .0597 .2063 .0397 .203 .0247 .203 .0146 .2137 .0146 .2233 .015 .232 .0156 .2407 .0163 .2497 .0175 .259 .0191 .2683 .0208 .2785 .0228 .2895 .0251 .3005 .0275 .3137 .0307 .329 .0347 .3423 .038 .3547 .0408 .366 .0431 .3773 .0455 .3885 .0475 .3995 .0491 .4105 .0508 .4218 .0521 .4335 .0531 .4452 .0541 .4583 .0553 .473 .0567Z"/><path id="font_1_6" d="M.442 .404C.4487 .404 .4565 .4026 .4655 .3999 .4745 .3971 .4827 .3936 .49 .3893 .4973 .385 .5035 .3805 .5085 .3758 .5135 .3711 .516 .3668 .516 .3629 .5027 .3353 .4903 .3075 .479 .2796 .4677 .2517 .458 .2249 .45 .1993 .442 .1737 .4358 .1497 .4315 .1273 .4272 .105 .425 .0856 .425 .0692 .425 .0508 .427 .0355 .431 .0234 .435 .0112 .4417 .0025 .451-.0028 .443-.008 .4327-.0123 .42-.0156 .4073-.0189 .396-.0205 .386-.0205 .35-.0205 .332 .0038 .332 .0524 .332 .0899 .3447 .1411 .37 .2062 .3567 .1761 .3413 .1478 .324 .1213 .3067 .0948 .289 .0714 .271 .0511 .253 .0308 .2348 .0143 .2165 .0016 .1982-.0112 .1813-.0189 .166-.0215 .1413-.0215 .1213-.0103 .106 .0122 .0907 .0346 .083 .0633 .083 .0981 .083 .1357 .091 .1752 .107 .2168 .123 .2583 .1435 .2969 .1685 .3324 .1935 .3679 .2207 .3975 .25 .4213 .2793 .4451 .3077 .457 .335 .457 .3417 .455 .3492 .451 .3575 .445 .3658 .439 .3738 .432 .3815 .424 .3892 .416 .3957 .4078 .401 .3995 .4063 .3911 .4093 .384 .41 .378 .3833 .374 .3558 .3609 .3275 .3389 .2992 .3169 .2735 .2904 .2505 .2594 .2275 .2283 .2087 .1951 .194 .1598 .1793 .1244 .172 .0914 .172 .0607 .172 .048 .1767 .04 .186 .0367 .2053 .0407 .2277 .0572 .253 .0863 .2783 .1154 .309 .1604 .345 .2213 .3517 .2334 .3592 .2468 .3675 .2615 .3758 .2762 .3843 .2916 .393 .3076 .4017 .3237 .4102 .3399 .4185 .3563 .4268 .3727 .4347 .3886 .442 .404Z"/><path id="font_1_7" d="M.099 .0931C.099 .1172 .1052 .1506 .1175 .1933 .1298 .2361 .146 .2829 .166 .3337 .186 .3845 .2087 .4369 .234 .4911 .2593 .5452 .2848 .5956 .3105 .6424 .3362 .6892 .3608 .7296 .3845 .7636 .4082 .7976 .4283 .8206 .445 .8326 .4543 .832 .4645 .828 .4755 .8206 .4865 .8133 .4967 .8045 .506 .7941 .5153 .7838 .5232 .773 .5295 .7616 .5358 .7503 .539 .74 .539 .7306 .509 .7064 .4785 .6752 .4475 .6371 .4165 .599 .387 .5572 .359 .5117 .331 .4662 .3052 .418 .2815 .3671 .2578 .3162 .238 .2662 .222 .217 .2433 .2545 .2657 .2886 .289 .3194 .3123 .3501 .3357 .3764 .359 .3982 .3823 .42 .4052 .4369 .4275 .4489 .4498 .4608 .471 .4668 .491 .4668 .5203 .4451 .535 .4164 .535 .3805 .535 .3588 .5307 .337 .522 .315 .5133 .293 .5018 .2727 .4875 .2541 .4732 .2355 .4568 .2196 .4385 .2064 .4202 .1932 .401 .1846 .381 .1805 .3877 .1575 .3962 .1342 .4065 .1105 .4168 .0869 .4292 .0639 .4435 .0415 .4578 .0192 .4742-.0015 .4925-.0205 .5108-.0396 .5317-.0557 .555-.0688 .5517-.0754 .5467-.082 .54-.0885 .5333-.0951 .5253-.1009 .516-.1058 .5067-.1107 .4965-.1147 .4855-.1176 .4745-.1206 .4637-.1221 .453-.1221 .435-.1221 .4182-.1132 .4025-.0955 .3868-.0777 .3727-.0521 .36-.0186 .35 .0084 .3403 .0405 .331 .078 .3217 .1154 .3133 .1545 .306 .1953 .3153 .2014 .327 .2104 .341 .2223 .355 .2342 .3697 .248 .385 .2637 .4437 .3215 .473 .3715 .473 .4137 .473 .4192 .4693 .4219 .462 .4219 .4487 .4219 .433 .4158 .415 .4038 .397 .3917 .3778 .375 .3575 .3536 .3372 .3321 .3165 .307 .2955 .2782 .2745 .2494 .2543 .2183 .235 .1848 .227 .1714 .2197 .156 .213 .1386 .2063 .1212 .2005 .1033 .1955 .0848 .1905 .0664 .1867 .0482 .184 .0301 .1813 .012 .18-.0047 .18-.0201 .18-.0295 .181-.0372 .183-.0432 .1623-.0412 .1497-.0359 .145-.0272 .1397-.0192 .1352-.0127 .1315-.0076 .1278-.0026 .124 .0015 .12 .0049 .114 .0096 .109 .0196 .105 .035 .101 .0503 .099 .0697 .099 .0931Z"/><path id="font_1_8" d="M.442 .3988C.4413 .3861 .4392 .3729 .4355 .3592 .4318 .3456 .4273 .3332 .422 .3222 .4167 .3112 .411 .302 .405 .2947 .399 .2874 .3933 .2837 .388 .2837 .3807 .2844 .3763 .2893 .375 .2985 .375 .3005 .3758 .3037 .3775 .308 .3792 .3124 .381 .3172 .383 .3226 .385 .3279 .3868 .3333 .3885 .3386 .3902 .344 .391 .3486 .391 .3526 .391 .362 .3888 .3699 .3845 .3762 .3802 .3826 .3743 .3857 .367 .3857 .3403 .3857 .32 .3691 .306 .3359 .292 .3026 .285 .2537 .285 .1892 .285 .1826 .2853 .1786 .286 .1772 .3 .1772 .3125 .1772 .3235 .1772 .3345 .1772 .3453 .1772 .356 .1772 .3567 .1759 .357 .1733 .357 .1693 .357 .1633 .3557 .159 .353 .1563 .3377 .153 .3255 .1502 .3165 .1479 .3075 .1456 .3007 .1434 .296 .1414 .2913 .1394 .2885 .1373 .2875 .1349 .2865 .1326 .286 .1295 .286 .1255 .286 .1202 .2862 .1149 .2865 .1096 .2868 .1042 .287 .0976 .287 .0897 .287 .0339 .2718-.0109 .2415-.0449 .2112-.0788 .169-.0985 .115-.1038 .1057-.1031 .096-.1005 .086-.0958 .076-.0911 .0665-.0851 .0575-.0778 .0485-.0705 .0407-.0623 .034-.0533 .0273-.0443 .0227-.0351 .02-.0258 .02-.0002 .0253 .0241 .036 .0473 .0467 .0706 .0612 .0911 .0795 .1089 .0978 .1267 .1195 .1412 .1445 .1523 .1695 .1634 .1967 .1689 .226 .1689 .226 .1857 .2243 .2021 .221 .2182 .2177 .2343 .2142 .2499 .2105 .265 .2068 .2801 .2033 .2948 .2 .3092 .1967 .3237 .195 .3379 .195 .352 .195 .3701 .1987 .388 .206 .4058 .2133 .4235 .223 .44 .235 .4551 .247 .4701 .261 .4831 .277 .4938 .293 .5045 .3097 .5119 .327 .5159 .3343 .5139 .3442 .5081 .3565 .4984 .3688 .4887 .381 .4779 .393 .4659 .405 .4538 .4157 .4417 .425 .4293 .4343 .4169 .44 .4068 .442 .3988M.112-.0578C.128-.0512 .1432-.0415 .1575-.0288 .1718-.0161 .1843-.0018 .195 .0142 .2057 .0303 .2142 .0473 .2205 .0653 .2268 .0833 .23 .101 .23 .1184 .2167 .1164 .202 .1102 .186 .0998 .17 .0895 .155 .0771 .141 .0628 .127 .0484 .1153 .0336 .106 .0182 .0967 .0029 .092-.0104 .092-.0218 .092-.0365 .0987-.0485 .112-.0578Z"/></defs><use data-text="R" xlink:href="#font_1_1" transform="matrix(228.92,-.22,-.22,-228.92,181.73,669.94)" fill="currentColor"/><use data-text="e" xlink:href="#font_1_2" transform="matrix(228.92,-.22,-.22,-228.92,330.3,669.79)" fill="currentColor"/><use data-text="n" xlink:href="#font_1_3" transform="matrix(228.92,-.22,-.22,-228.92,422.78,669.7)" fill="currentColor"/><use data-text="t" xlink:href="#font_1_4" transform="matrix(228.92,-.22,-.22,-228.92,546.4,669.58)" fill="currentColor"/><use data-text="L" xlink:href="#font_1_5" transform="matrix(228.92,-.22,-.22,-228.92,625.83,669.51)" fill="currentColor"/><use data-text="e" xlink:href="#font_1_2" transform="matrix(228.92,-.22,-.22,-228.92,729.99,669.41)" fill="currentColor"/><use data-text="a" xlink:href="#font_1_6" transform="matrix(228.92,-.22,-.22,-228.92,822.47,669.32)" fill="currentColor"/><use data-text="k" xlink:href="#font_1_7" transform="matrix(228.92,-.22,-.22,-228.92,930.07,669.21)" fill="currentColor"/><use data-text="s" xlink:href="#font_1_8" transform="matrix(228.92,-.22,-.22,-228.92,1048.19,669.1)" fill="currentColor"/><path transform="matrix(.59,0,0,.59,79.53,448.75)" d="M345.41 152.65C345.41 151.55 344.52 150.65 343.41 150.65 342.31 150.65 341.41 151.55 341.41 152.65V302.65C341.41 303.75 342.31 304.65 343.41 304.65 344.52 304.65 345.41 303.75 345.41 302.65V152.65Z" fill="currentColor"/><path transform="matrix(.59,0,0,.59,79.53,448.75)" d="M275.31 18.94C276.41 18.94 277.31 18.04 277.31 16.94 277.31 15.83 276.41 14.94 275.31 14.94 274.2 14.94 273.31 15.83 273.31 16.94 273.31 18.04 274.2 18.94 275.31 18.94Z" fill="currentColor"/><path transform="matrix(.59,0,0,.59,79.53,448.75)" d="M79.18 34.81C79.53 35.08 79.95 35.22 80.4 35.22 81.02 35.22 81.6 34.94 81.98 34.44 89.57 24.59 100.98 18.94 113.31 18.94H263.31C264.41 18.94 265.3 18.04 265.3 16.94 265.3 15.84 264.41 14.94 263.31 14.94H113.31C106.46 14.94 99.89 16.5 93.79 19.59 87.97 22.53 82.8 26.82 78.81 32 78.54 32.36 78.39 32.79 78.4 33.24 78.4 33.86 78.69 34.43 79.18 34.81Z" fill="currentColor"/><path transform="matrix(.59,0,0,.59,79.53,448.75)" d="M343.41 138.65C342.31 138.65 341.41 139.55 341.41 140.65 341.41 141.75 342.31 142.65 343.41 142.65 344.52 142.65 345.41 141.75 345.41 140.65 345.41 139.55 344.52 138.65 343.41 138.65Z" fill="currentColor"/><path transform="matrix(.59,0,0,.59,79.53,448.75)" d="M343.41 312.65C342.31 312.65 341.41 313.55 341.41 314.65 341.41 315.75 342.31 316.65 343.41 316.65 344.52 316.65 345.41 315.75 345.41 314.65 345.41 313.55 344.52 312.65 343.41 312.65Z" fill="currentColor"/><path transform="matrix(.59,0,0,.59,79.53,448.75)" d="M287.31 18.94H301.92C312.42 18.94 322.33 23.06 329.81 30.54 337.29 38.01 341.41 47.91 341.41 58.4V71.54H245.81C244.71 71.54 243.81 72.43 243.81 73.54 243.81 74.64 244.71 75.54 245.81 75.54H341.41V128.65C341.41 129.75 342.31 130.65 343.41 130.65 344.52 130.65 345.41 129.75 345.41 128.65V58.4C345.41 52.55 344.26 46.88 341.98 41.52 339.78 36.35 336.64 31.7 332.64 27.71 328.64 23.71 323.99 20.57 318.81 18.37 313.45 16.09 307.77 14.94 301.92 14.94H287.31C286.2 14.94 285.31 15.83 285.31 16.94 285.31 18.04 286.2 18.94 287.31 18.94Z" fill="currentColor"/><path transform="matrix(.59,0,0,.59,79.53,448.75)" d="M335.91 474.57C335.63 475.03 335.55 475.57 335.68 476.09 335.82 476.61 336.14 477.04 336.6 477.31 336.91 477.5 337.26 477.6 337.62 477.6 338.32 477.6 338.98 477.22 339.34 476.62 343.32 469.94 345.41 462.3 345.41 454.54V326.65C345.41 325.55 344.52 324.65 343.41 324.65 342.31 324.65 341.41 325.55 341.41 326.65V411.02H245.81C244.71 411.02 243.81 411.91 243.81 413.02 243.81 414.12 244.71 415.02 245.81 415.02H341.41V454.54C341.41 461.58 339.51 468.51 335.91 474.57Z" fill="currentColor"/><path transform="matrix(.59,0,0,.59,79.53,448.75)" d="M328.74 483.43C327.94 484.18 327.89 485.45 328.64 486.26 329.02 486.66 329.55 486.9 330.11 486.9 330.61 486.9 331.09 486.71 331.46 486.37 331.46 486.37 331.46 486.36 331.47 486.36 331.86 486 332.08 485.5 332.1 484.97 332.12 484.44 331.94 483.93 331.57 483.53 330.85 482.76 329.52 482.71 328.74 483.43Z" fill="currentColor"/><path transform="matrix(.59,0,0,.59,79.53,448.75)" d="M71.81 381.31C72.92 381.31 73.81 380.41 73.81 379.31V229.31C73.81 228.21 72.92 227.31 71.81 227.31 70.71 227.31 69.81 228.21 69.81 229.31V379.31C69.81 380.41 70.71 381.31 71.81 381.31Z" fill="currentColor"/><path transform="matrix(.59,0,0,.59,79.53,448.75)" d="M158.94 494C157.84 494 156.94 494.9 156.94 496 156.94 497.1 157.84 498 158.94 498 160.05 498 160.94 497.1 160.94 496 160.94 494.9 160.05 494 158.94 494Z" fill="currentColor"/><path transform="matrix(.59,0,0,.59,79.53,448.75)" d="M71.81 393.31C72.92 393.31 73.81 392.41 73.81 391.31 73.81 390.21 72.92 389.31 71.81 389.31 70.71 389.31 69.81 390.21 69.81 391.31 69.81 392.41 70.71 393.31 71.81 393.31Z" fill="currentColor"/><path transform="matrix(.59,0,0,.59,79.53,448.75)" d="M73.82 45.52C74.06 45.6 74.3 45.65 74.54 45.65 75.36 45.65 76.11 45.13 76.41 44.37V44.36C76.6 43.86 76.59 43.32 76.37 42.83 76.15 42.35 75.76 41.97 75.26 41.78 74.26 41.4 73.07 41.93 72.68 42.92V42.93C72.28 43.96 72.79 45.12 73.82 45.52Z" fill="currentColor"/><path transform="matrix(.59,0,0,.59,79.53,448.75)" d="M71.81 219.31C72.92 219.31 73.81 218.41 73.81 217.31 73.81 216.21 72.92 215.31 71.81 215.31 70.71 215.31 69.81 216.21 69.81 217.31 69.81 218.41 70.71 219.31 71.81 219.31Z" fill="currentColor"/><path transform="matrix(.59,0,0,.59,79.53,448.75)" d="M71.81 207.31C72.92 207.31 73.81 206.41 73.81 205.31V75.54H221.81C222.92 75.54 223.81 74.64 223.81 73.54 223.81 72.43 222.92 71.54 221.81 71.54H73.81V58.4C73.81 57.41 73.85 56.42 73.92 55.46 74 54.36 73.18 53.4 72.08 53.32 70.98 53.24 70.02 54.08 69.93 55.17 69.85 56.26 69.81 57.35 69.81 58.4V205.31C69.81 206.41 70.71 207.31 71.81 207.31Z" fill="currentColor"/><path transform="matrix(.59,0,0,.59,79.53,448.75)" d="M146.94 494H113.31C102.81 494 92.9 489.88 85.42 482.4 77.93 474.92 73.81 465.03 73.81 454.54V415.02H221.81C222.92 415.02 223.81 414.12 223.81 413.02 223.81 411.91 222.92 411.02 221.81 411.02H73.81V403.31C73.81 402.21 72.92 401.31 71.81 401.31 70.71 401.31 69.82 402.21 69.82 403.31L69.82 412.94C69.82 412.97 69.81 412.99 69.81 413.02 69.81 413.05 69.82 413.07 69.82 413.1L69.81 454.54C69.82 460.38 70.97 466.06 73.25 471.41 75.44 476.59 78.59 481.23 82.59 485.23 86.59 489.23 91.24 492.37 96.41 494.57 101.77 496.84 107.46 498 113.31 498H146.94C148.05 498 148.94 497.1 148.94 496 148.94 494.9 148.05 494 146.94 494Z" fill="currentColor"/><path transform="matrix(.59,0,0,.59,79.53,448.75)" d="M233.81 75.54C234.92 75.54 235.81 74.64 235.81 73.54 235.81 72.43 234.92 71.54 233.81 71.54 232.71 71.54 231.81 72.43 231.81 73.54 231.81 74.64 232.71 75.54 233.81 75.54Z" fill="currentColor"/><path transform="matrix(.59,0,0,.59,79.53,448.75)" d="M231.81 413.02C231.81 414.12 232.71 415.02 233.81 415.02 234.92 415.02 235.81 414.12 235.81 413.02 235.81 411.91 234.92 411.02 233.81 411.02 232.71 411.02 231.81 411.91 231.81 413.02Z" fill="currentColor"/><path transform="matrix(.59,0,0,.59,79.53,448.75)" d="M244.73 44.74C244.73 43.64 243.83 42.74 242.73 42.74H173.41C172.31 42.74 171.41 43.64 171.41 44.74 171.41 45.84 172.31 46.74 173.41 46.74H242.73C243.83 46.74 244.73 45.84 244.73 44.74Z" fill="currentColor"/><path transform="matrix(.59,0,0,.59,79.53,448.75)" d="M208.07 432.69C202.38 432.69 197.02 434.91 193 438.94 188.97 442.98 186.75 448.35 186.75 454.06 186.76 465.82 196.32 475.38 208.07 475.38 219.84 475.38 229.42 465.82 229.42 454.06 229.41 448.35 227.19 442.98 223.16 438.94 219.13 434.91 213.77 432.69 208.07 432.69ZM208.07 471.38C198.54 471.36 190.77 463.6 190.75 454.06 190.77 444.5 198.54 436.7 208.07 436.69 217.64 436.7 225.42 444.5 225.42 454.06 225.4 463.6 217.62 471.36 208.07 471.38Z" fill="currentColor"/><path transform="matrix(.59,0,0,.59,79.53,448.75)" d="M133.01 233.09V312.75C133.01 313.85 133.91 314.75 135.01 314.75 136.11 314.75 137.01 313.85 137.01 312.75V234.34L199.03 203.9C199.51 203.66 199.87 203.25 200.05 202.75 200.22 202.24 200.18 201.7 199.95 201.22 199.47 200.25 198.24 199.83 197.27 200.31L134.13 231.29C133.44 231.63 133.01 232.32 133.01 233.09Z" fill="currentColor"/><path transform="matrix(.59,0,0,.59,79.53,448.75)" d="M282.22 233.09C282.22 232.32 281.79 231.63 281.1 231.29L220.58 201.58C219.61 201.11 218.38 201.53 217.9 202.5 217.67 202.98 217.63 203.52 217.81 204.02 217.98 204.53 218.34 204.94 218.82 205.17L278.22 234.34V315.67C278.22 316.77 279.12 317.67 280.22 317.67 281.32 317.67 282.22 316.77 282.22 315.67V233.09Z" fill="currentColor"/><path transform="matrix(.59,0,0,.59,79.53,448.75)" d="M281.63 345.87C282.01 345.5 282.22 345 282.22 344.46V339.67C282.22 338.57 281.32 337.67 280.22 337.67 279.12 337.67 278.22 338.57 278.22 339.67V342.46H227.77V289.04C227.77 288.52 227.56 288 227.18 287.63 226.81 287.25 226.3 287.04 225.77 287.04H190.9C190.38 287.04 189.86 287.25 189.49 287.63 189.12 288 188.9 288.51 188.9 289.04V295.61C188.9 296.71 189.8 297.61 190.9 297.61 192.01 297.61 192.9 296.71 192.9 295.61V291.04H223.77V342.46H192.9V319.61C192.9 318.51 192.01 317.61 190.9 317.61 189.8 317.61 188.91 318.51 188.91 319.61L188.9 342.46H137.01V336.75C137.01 335.65 136.11 334.75 135.01 334.75 133.91 334.75 133.01 335.65 133.01 336.75V344.46C133.01 344.99 133.22 345.5 133.6 345.87 133.97 346.25 134.48 346.46 135.01 346.46H190.9 225.77 280.22C280.75 346.46 281.25 346.25 281.63 345.87Z" fill="currentColor"/><path transform="matrix(.59,0,0,.59,79.53,448.75)" d="M280.22 325.67C279.12 325.67 278.22 326.57 278.22 327.67 278.22 328.77 279.12 329.67 280.22 329.67 281.32 329.67 282.22 328.77 282.22 327.67 282.22 326.57 281.32 325.67 280.22 325.67Z" fill="currentColor"/><path transform="matrix(.59,0,0,.59,79.53,448.75)" d="M207.13 197.21C206.65 198.2 207.06 199.4 208.05 199.89 208.32 200.02 208.62 200.09 208.92 200.09 209.69 200.09 210.38 199.66 210.72 198.97 211.21 197.98 210.8 196.78 209.81 196.3 208.84 195.82 207.6 196.24 207.13 197.21Z" fill="currentColor"/><path transform="matrix(.59,0,0,.59,79.53,448.75)" d="M135.01 322.75C133.91 322.75 133.01 323.65 133.01 324.75 133.01 325.85 133.91 326.75 135.01 326.75 136.11 326.75 137.01 325.85 137.01 324.75 137.01 323.65 136.11 322.75 135.01 322.75Z" fill="currentColor"/><path transform="matrix(.59,0,0,.59,79.53,448.75)" d="M206.75 166.68 169.35 185.04C168.36 185.53 167.95 186.73 168.43 187.72 168.91 188.69 170.14 189.11 171.11 188.63L207.63 170.71 303.98 218.04C304.26 218.17 304.56 218.24 304.86 218.24 305.63 218.24 306.32 217.81 306.66 217.12 306.9 216.64 306.93 216.1 306.76 215.6 306.59 215.09 306.23 214.68 305.75 214.45L208.51 166.68C207.96 166.41 207.29 166.41 206.75 166.68Z" fill="currentColor"/><path transform="matrix(.59,0,0,.59,79.53,448.75)" d="M147.8 195.62 109.45 214.45C108.46 214.93 108.05 216.13 108.54 217.12 108.88 217.81 109.57 218.24 110.33 218.24 110.64 218.24 110.94 218.17 111.21 218.04L149.57 199.21C150.25 198.87 150.69 198.16 150.68 197.4 150.68 197.1 150.61 196.81 150.48 196.53 150 195.57 148.77 195.14 147.8 195.62Z" fill="currentColor"/><path transform="matrix(.59,0,0,.59,79.53,448.75)" d="M159.46 194.13C159.76 194.13 160.06 194.06 160.34 193.92 161.33 193.43 161.74 192.23 161.25 191.24 160.78 190.28 159.55 189.85 158.57 190.33 158.1 190.57 157.74 190.97 157.56 191.48 157.39 191.99 157.42 192.53 157.66 193.01 158 193.7 158.69 194.13 159.46 194.13Z" fill="currentColor"/><path transform="matrix(.59,0,0,.59,79.53,448.75)" d="M190.9 309.61C192.01 309.61 192.9 308.71 192.9 307.61 192.9 306.51 192.01 305.61 190.9 305.61 189.8 305.61 188.9 306.51 188.9 307.61 188.9 308.71 189.8 309.61 190.9 309.61Z" fill="currentColor"/><path transform="matrix(.59,0,0,.59,79.53,448.75)" d="M384.08 494H320.06C320.42 493.83 320.8 493.67 321.16 493.49 321.84 493.15 322.28 492.43 322.27 491.67 322.27 491.37 322.2 491.08 322.06 490.81 321.59 489.85 320.35 489.43 319.39 489.9H319.38C313.91 492.62 308.04 494 301.92 494H266.61 170.94C169.84 494 168.94 494.9 168.94 496 168.94 497.1 169.84 498 170.94 498H266.61 301.94 384.08C385.18 498 386.08 497.1 386.08 496 386.08 494.9 385.18 494 384.08 494Z" fill="currentColor"/></svg>';
  const DATA = window.RENTLEAKS_DATA || { listings: [], cities: [], housingTypes: [] };
  const STORE = {
    saved: 'rl_saved',
    compare: 'rl_compare',
    profile: 'rl_profile',
    session: 'rl_session',
    alerts: 'rl_alerts',
    listings: 'rl_my_listings',
    recent: 'rl_recent',
    match: 'rl_match',
    currency: 'rl_currency'
  };

  const state = {
    type: '',
    city: '',
    location: '',
    priceMin: null,
    priceMax: null,
    beds: null,
    minStay: null,
    moveIn: '',
    furnished: '',
    pets: '',
    privateBath: false,
    workspace: false,
    noFee: false,
    utilitiesIn: false,
    verified: false,
    sort: 'newest',
    view: 'grid',
    page: 1
  };
  const PAGE_SIZE = 24;
  let browseMap = null;
  let browseMarkers = [];

  /* ---------- theme ---------- */
  function currentTheme() {
    try { return localStorage.getItem('rl_theme') || 'system'; } catch (e) { return 'system'; }
  }
  function applyTheme(mode) {
    const root = document.documentElement;
    if (mode === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', mode);
    try { localStorage.setItem('rl_theme', mode); } catch (e) {}
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const dark = mode === 'dark' || (mode === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
      meta.setAttribute('content', dark ? '#0B1418' : '#FAF7F2');
    }
  }
  function resolvedDark() {
    const m = currentTheme();
    if (m === 'dark') return true;
    if (m === 'light') return false;
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
  function toggleTheme() { applyTheme(resolvedDark() ? 'light' : 'dark'); }

  /* ---------- value signal: all-in vs city benchmark ---------- */
  function cityBenchmark(l) {
    const c = cityMeta(l.cityId);
    if (!c) return null;
    const roomish = l.housingType === 'room' || l.housingType === 'coliving';
    // City benchmarks are stored in that city's own currency, matching the
    // listing, so no conversion is needed here.
    const base = roomish ? c.avgRoom : c.avgFurnished;
    return Number.isFinite(base) && base > 0 ? base : null;
  }
  function leakChip(l) {
    const base = cityBenchmark(l);
    if (!base) return '';
    const delta = Math.round(((allIn(l) - base) / base) * 100);
    if (delta <= -8) return '<span class="rl-leak rl-leak--under" title="Versus the typical all-in price in this market">' + Math.abs(delta) + '% under market</span>';
    if (delta >= 12) return '<span class="rl-leak rl-leak--over" title="Versus the typical all-in price in this market">' + delta + '% over market</span>';
    return '<span class="rl-leak" title="Versus the typical all-in price in this market">At market</span>';
  }

  /* ---------- fee transparency ---------- */
  const FEE_LABELS = { broker: 'Broker fee', utilities: 'Utilities', wifi: 'Wi-Fi', cleaning: 'Cleaning', parking: 'Parking', amenity: 'Amenity fee', admin: 'Admin fee' };
  function feeRows(l) {
    const fees = l.fees || {};
    const rows = [{ k: 'Base rent', v: money(l.price, l), zero: false }];
    Object.keys(fees).forEach((k) => {
      const amount = Number(fees[k] || 0);
      rows.push({ k: FEE_LABELS[k] || k, v: amount ? money(amount, l) : 'Included', zero: !amount });
    });
    return rows;
  }
  function feeStackHtml(l) {
    return '<div class="rl-fee-stack">' +
      feeRows(l).map((r) => '<div class="rl-fee-stack__row' + (r.zero ? ' rl-fee-stack__row--zero' : '') + '"><span>' + escapeHtml(r.k) + '</span><span>' + r.v + '</span></div>').join('') +
      '<div class="rl-fee-stack__row rl-fee-stack__row--total"><span>All-in / month</span><span>' + money(allIn(l), l) + '</span></div>' +
      '</div>';
  }
  function closeFeePop() {
    const el = $('#rl-fee-pop');
    if (el) el.remove();
  }
  function openFeePop(trigger, id) {
    closeFeePop();
    const l = listingById(id);
    if (!l) return;
    const pop = document.createElement('div');
    pop.id = 'rl-fee-pop';
    pop.className = 'rl-pop-over';
    pop.innerHTML = '<p class="rl-side__title" style="margin-bottom:.5rem">What you actually pay</p>' + feeStackHtml(l);
    document.body.appendChild(pop);
    const r = trigger.getBoundingClientRect();
    const w = pop.offsetWidth;
    let left = r.left + window.scrollX;
    if (left + w > window.innerWidth - 12) left = window.innerWidth - w - 12;
    pop.style.position = 'absolute';
    pop.style.left = Math.max(12, left) + 'px';
    pop.style.top = (r.bottom + window.scrollY + 8) + 'px';
  }

  /* ---------- svg icons ---------- */
  function iconSearch() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';
  }
  function iconSun() {
    return '<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  }
  function iconMoon() {
    return '<svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  }

  /* ---------- progressive enhancement of any search form ---------- */
  function decorateSearchFields() {
    $$('.search-field').forEach((field) => {
      if (field.querySelector('.search-field__label')) return;
      const control = field.querySelector('input, select');
      if (!control) return;
      const text = control.getAttribute('aria-label') || control.getAttribute('placeholder') || '';
      if (!text) return;
      const label = document.createElement('span');
      label.className = 'search-field__label';
      label.textContent = text.length > 18 ? text.slice(0, 17) + '…' : text;
      field.insertBefore(label, field.firstChild);
      field.classList.add('search-field--labeled');
      if (control.tagName === 'INPUT' && control.placeholder === text) {
        control.placeholder = control.type === 'number' ? 'Any' : 'Any area';
      }
    });
    $$('.btn--search').forEach((btn) => {
      if (btn.dataset.iconised) return;
      btn.dataset.iconised = '1';
      const label = btn.textContent.trim() || 'Search';
      btn.innerHTML = iconSearch() + '<span class="btn__label">' + label + '</span>';
      btn.setAttribute('aria-label', label);
    });
  }

  /* ---------- skeletons ---------- */
  function skeletonCards(n) {
    let html = '';
    for (let i = 0; i < n; i += 1) {
      html += '<div class="rl-skel-card"><div class="rl-skel"></div><div class="rl-skel"></div><div class="rl-skel"></div><div class="rl-skel"></div></div>';
    }
    return html;
  }

  /* ---------- active filter chips ---------- */
  const CHIP_DEFS = [
    { key: 'type', label: (v) => typeMeta(v).label },
    { key: 'city', label: (v) => (cityMeta(v) || {}).name || v },
    { key: 'location', label: (v) => '“' + v + '”' },
    { key: 'priceMin', label: (v) => 'From ' + money(v) },
    { key: 'priceMax', label: (v) => 'Up to ' + money(v) },
    { key: 'minStay', label: (v) => v + ' mo stay' },
    { key: 'moveIn', label: (v) => 'By ' + formatDate(v) },
    { key: 'privateBath', label: () => 'Private bath' },
    { key: 'workspace', label: () => 'Workspace' },
    { key: 'noFee', label: () => 'No broker fee' },
    { key: 'utilitiesIn', label: () => 'Utilities included' },
    { key: 'verified', label: () => 'Verified host' },
    { key: 'furnished', label: () => 'Fully furnished' },
    { key: 'pets', label: () => 'Pets ok' }
  ];
  function renderChips() {
    const host = $('#rl-chips');
    if (!host) return;
    const chips = CHIP_DEFS.filter((d) => state[d.key]).map((d) =>
      '<button type="button" class="rl-chip is-on" data-chip="' + d.key + '">' +
      escapeHtml(String(d.label(state[d.key]))) + '<span class="rl-chip__x" aria-hidden="true">✕</span>' +
      '<span class="sr-only">Remove filter</span></button>');
    if (chips.length > 1) chips.push('<button type="button" class="rl-chip rl-chip--clear" data-chip="__all">Clear all</button>');
    host.innerHTML = chips.join('');
    host.hidden = chips.length === 0;
  }
  function clearFilter(key) {
    state.page = 1;
    const boolKeys = { privateBath: 1, workspace: 1, noFee: 1, utilitiesIn: 1, verified: 1 };
    if (key === '__all') {
      CHIP_DEFS.forEach((d) => { state[d.key] = boolKeys[d.key] ? false : (d.key === 'priceMin' || d.key === 'priceMax' || d.key === 'minStay' ? null : ''); });
    } else {
      state[key] = boolKeys[key] ? false : (key === 'priceMin' || key === 'priceMax' || key === 'minStay' ? null : '');
    }
    syncFormFromState();
    pushBrowseUrl();
    renderListings();
  }
  function syncFormFromState() {
    const set = (sel, val) => { const el = $(sel); if (el) el.value = val == null ? '' : val; };
    set('#city', state.city); set('#housing-type', state.type); set('#location', state.location);
    set('#price-min', state.priceMin); set('#price-max', state.priceMax);
    set('#min-stay', state.minStay); set('#move-in', state.moveIn);
    const chk = (sel, on) => { const el = $(sel); if (el) el.checked = !!on; };
    chk('#filter-furnished', state.furnished === 'fully');
    chk('#filter-pets', state.pets === 'yes');
    chk('#filter-bath', state.privateBath);
    chk('#filter-work', state.workspace);
    chk('#filter-nofee', state.noFee);
    chk('#filter-utils', state.utilitiesIn);
    chk('#filter-verified', state.verified);
  }

  /* ---------- filter rail state ---------- */
  function paintRail() {
    const mark = (sel, attr, value) => {
      $$(sel + ' [' + attr + ']').forEach((b) => {
        b.classList.toggle('is-on', String(b.getAttribute(attr)) === String(value == null ? '' : value));
      });
    };
    mark('#rl-opt-type', 'data-set-type', state.type);
    mark('#rl-opt-beds', 'data-set-beds', state.beds);
    mark('#rl-opt-stay', 'data-set-stay', state.minStay);
    mark('#rl-opt-budget', 'data-set-max', state.priceMax);
    const min = $('#rail-min'); const max = $('#rail-max');
    if (min && document.activeElement !== min) min.value = state.priceMin || '';
    if (max && document.activeElement !== max) max.value = state.priceMax || '';
  }

  /* ---------- live data bridge ---------- */
  // Server-side results, when the API answered. null means "use the baked
  // catalog", which is also what we fall back to on any failure.
  let liveResult = null;

  function apiEnabled() {
    return !!(window.RLData && window.RLData.enabled);
  }

  function markLiveState(isLive) {
    document.body.classList.toggle('rl-live', !!isLive);
    const dot = $('#rl-live-badge');
    if (dot) {
      dot.textContent = isLive ? 'Live' : 'Cached';
      dot.classList.toggle('is-stale', !isLive);
    }
  }

  /* ---------- pagination ---------- */
  function renderPager(shown, total) {
    let pager = $('#rl-pager');
    const results = $('#rl-results') || ($('#listings-grid') || {}).parentNode;
    if (!results) return;
    if (!pager) {
      pager = document.createElement('div');
      pager.id = 'rl-pager';
      pager.className = 'rl-pager';
      results.appendChild(pager);
    }
    if (!total) { pager.hidden = true; return; }
    pager.hidden = false;
    const done = shown >= total;
    pager.innerHTML =
      '<p class="rl-pager__count">Showing <strong>' + shown.toLocaleString() + '</strong> of <strong>' + total.toLocaleString() + '</strong> homes</p>' +
      '<div class="rl-pager__bar"><span style="width:' + Math.round((shown / total) * 100) + '%"></span></div>' +
      (done
        ? '<p class="rl-pager__end">That is every home matching these filters.</p>'
        : '<button type="button" class="btn btn--outline js-load-more">Show ' + Math.min(PAGE_SIZE, total - shown) + ' more</button>');
  }

  /* ---------- mobile filter sheet ---------- */
  function openFilterSheet() {
    const side = $('#rl-filters');
    if (!side) return;
    side.classList.add('is-open');
    let scrim = $('#rl-scrim');
    if (!scrim) {
      scrim = document.createElement('div');
      scrim.id = 'rl-scrim';
      scrim.className = 'rl-scrim';
      document.body.appendChild(scrim);
      scrim.addEventListener('click', closeFilterSheet);
    }
    requestAnimationFrame(() => scrim.classList.add('is-open'));
    document.body.style.overflow = 'hidden';
  }
  function closeFilterSheet() {
    const side = $('#rl-filters');
    if (side) side.classList.remove('is-open');
    const scrim = $('#rl-scrim');
    if (scrim) scrim.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  function appOrigin() {
    if (window.RL_APP_URL) return String(window.RL_APP_URL).replace(/\/$/, '');
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return 'http://localhost:3100';
    return '';
  }
  function appHref(path, fallback) {
    const origin = appOrigin();
    return origin ? origin + path : assetBase() + fallback;
  }

  function $(sel, el) { return (el || document).querySelector(sel); }
  function $$(sel, el) { return Array.from((el || document).querySelectorAll(sel)); }
  /* ---------------------------------------------------------------------
   * Money
   * -------------------------------------------------------------------
   * Prices are stored in each market's own currency. Everything on screen is
   * converted into ONE display currency so figures stay comparable — mixing
   * £1,840 and C$1,415 in a sorted list is meaningless.
   *
   * money(amount, ctx) where ctx is a currency code, or any object carrying
   * one (a listing or a city). Omit ctx only for figures already expressed in
   * the display currency, such as the visitor's own budget input.
   * ------------------------------------------------------------------- */
  const CURRENCIES = ['USD', 'CAD', 'EUR', 'GBP', 'CHF'];

  function displayCurrency() {
    const saved = read(STORE.currency, null);
    if (saved && CURRENCIES.indexOf(saved) !== -1) return saved;
    // Fall back to something sensible for the visitor's locale.
    try {
      const region = (navigator.language || '').split('-')[1];
      const byRegion = { CA: 'CAD', GB: 'GBP', CH: 'CHF', IE: 'EUR', FR: 'EUR', ES: 'EUR', NL: 'EUR', DE: 'EUR', IT: 'EUR' };
      if (region && byRegion[region]) return byRegion[region];
    } catch (e) { /* ignore */ }
    return 'USD';
  }

  function setDisplayCurrency(code) {
    if (CURRENCIES.indexOf(code) === -1) return;
    write(STORE.currency, code);
    document.dispatchEvent(new CustomEvent('rl:currency', { detail: code }));
  }

  function sourceCurrency(ctx) {
    if (!ctx) return null;
    if (typeof ctx === 'string') return ctx;
    if (ctx.currency) return ctx.currency;
    if (ctx.cityId) {
      const c = cityMeta(ctx.cityId);
      if (c && c.currency) return c.currency;
    }
    if (ctx.country && DATA.currencyForCountry) return DATA.currencyForCountry(ctx.country);
    return null;
  }

  function money(n, ctx) {
    const to = displayCurrency();
    const from = sourceCurrency(ctx) || to;
    const value = DATA.convert ? DATA.convert(n, from, to) : Number(n || 0);
    try {
      return new Intl.NumberFormat(document.documentElement.lang || undefined, {
        style: 'currency', currency: to,
        minimumFractionDigits: 0, maximumFractionDigits: 0
      }).format(Math.round(value));
    } catch (e) {
      return (to === 'USD' ? '$' : to + ' ') + Math.round(value).toLocaleString();
    }
  }

  /** Comparable figure for sorting and budget filters, regardless of market. */
  function allInDisplay(l) {
    return DATA.convert
      ? DATA.convert(allIn(l), sourceCurrency(l) || 'USD', displayCurrency())
      : allIn(l);
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
  function params() { return new URLSearchParams(window.location.search); }
  function typeMeta(id) {
    return (DATA.housingTypes || []).find((t) => t.id === id) || { id: id, label: id, short: id };
  }
  function cityMeta(id) {
    if (DATA.getCity) return DATA.getCity(id);
    return (DATA.cities || []).find((c) => c.id === id);
  }
  function listingById(id) {
    return (DATA.listings || []).find((l) => String(l.id) === String(id));
  }

  function listingMedia(l) {
    if (!l) return [];
    if (l.gallery && l.gallery.length) return l.gallery;
    const photos = (l.images || [l.image]).filter(Boolean).map((src, i) => ({
      kind: 'photo',
      src: src,
      caption: i === 0 ? 'Main photo' : 'Photo ' + (i + 1),
      alt: l.imageAlt || l.title
    }));
    if (l.video) {
      photos.push({
        kind: 'video',
        src: l.video.src,
        poster: l.video.poster || l.image,
        caption: l.video.caption || 'Video tour',
        alt: 'Video tour of ' + l.title
      });
    }
    return photos;
  }

  const lbState = { items: [], index: 0 };

  function ensureLightbox() {
    let el = $('#rl-lb');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'rl-lb';
    el.className = 'rl-lb';
    el.hidden = true;
    el.innerHTML = `
      <div class="rl-lb__shade" data-lb-close></div>
      <div class="rl-lb__panel" role="dialog" aria-modal="true" aria-label="Photo and video gallery">
        <button type="button" class="rl-lb__close" data-lb-close aria-label="Close gallery">Close</button>
        <button type="button" class="rl-lb__nav rl-lb__nav--prev" data-lb-step="-1" aria-label="Previous">‹</button>
        <button type="button" class="rl-lb__nav rl-lb__nav--next" data-lb-step="1" aria-label="Next">›</button>
        <div class="rl-lb__stage" id="rl-lb-stage"></div>
        <div class="rl-lb__meta">
          <p class="rl-lb__count" id="rl-lb-count"></p>
          <p class="rl-lb__cap" id="rl-lb-cap"></p>
        </div>
        <div class="rl-lb__film" id="rl-lb-film"></div>
      </div>`;
    document.body.appendChild(el);
    return el;
  }

  function paintLightbox() {
    const items = lbState.items;
    const item = items[lbState.index];
    if (!item) return;
    const stage = $('#rl-lb-stage');
    const cap = $('#rl-lb-cap');
    const count = $('#rl-lb-count');
    if (item.kind === 'video') {
      stage.innerHTML = '<video class="rl-lb__video" src="' + item.src + '" poster="' + escapeHtml(item.poster || '') + '" controls autoplay playsinline></video>';
    } else {
      const playing = stage.querySelector('video');
      if (playing) playing.pause();
      stage.innerHTML = '<img class="rl-lb__img" src="' + item.src + '" alt="' + escapeHtml(item.alt || item.caption || '') + '">';
    }
    if (cap) cap.textContent = item.caption || '';
    if (count) count.textContent = (lbState.index + 1) + ' / ' + items.length;
    $$('#rl-lb-film [data-lb-goto]').forEach((b) => b.classList.toggle('is-on', Number(b.dataset.lbGoto) === lbState.index));
  }

  function openLightbox(items, index) {
    lbState.items = items || [];
    lbState.index = Math.max(0, Math.min(Number(index) || 0, Math.max(0, lbState.items.length - 1)));
    const el = ensureLightbox();
    const film = $('#rl-lb-film');
    if (film) {
      film.innerHTML = lbState.items.map((item, idx) => {
        const thumb = item.kind === 'video' ? (item.poster || item.src) : item.src;
        return '<button type="button" class="rl-lb__thumb' + (idx === lbState.index ? ' is-on' : '') + '" data-lb-goto="' + idx + '">' +
          '<img src="' + thumb + '" alt="">' +
          (item.kind === 'video' ? '<span class="rl-lb__play">▶</span>' : '') +
          '</button>';
      }).join('');
    }
    el.hidden = false;
    el.classList.add('is-open');
    document.body.classList.add('rl-lb-lock');
    paintLightbox();
  }

  function closeLightbox() {
    const el = $('#rl-lb');
    if (!el) return;
    const vid = el.querySelector('video');
    if (vid) vid.pause();
    el.hidden = true;
    el.classList.remove('is-open');
    document.body.classList.remove('rl-lb-lock');
  }

  function stepLightbox(dir) {
    if (!lbState.items.length) return;
    lbState.index = (lbState.index + dir + lbState.items.length) % lbState.items.length;
    paintLightbox();
  }

  function renderGalleryMosaic(l) {
    const items = listingMedia(l);
    const photos = items.filter((x) => x.kind === 'photo');
    const video = items.find((x) => x.kind === 'video');
    const show = photos.slice(0, 4);
    const tiles = show.map((item, i) => (
      '<button type="button" class="rl-mosaic__cell' + (i === 0 ? ' rl-mosaic__cell--hero' : '') + '" data-open-gallery="' + escapeHtml(l.id) + '" data-gallery-index="' + items.indexOf(item) + '">' +
        '<img src="' + item.src + '" alt="' + escapeHtml(item.alt || item.caption || l.title) + '" width="1400" height="933">' +
        '<span class="rl-mosaic__label">' + escapeHtml(item.caption || '') + '</span></button>'
    )).join('');
    const videoIndex = video ? items.indexOf(video) : 0;
    const videoTile = video
      ? '<button type="button" class="rl-mosaic__cell rl-mosaic__cell--video" data-open-gallery="' + escapeHtml(l.id) + '" data-gallery-index="' + videoIndex + '">' +
        '<img src="' + (video.poster || l.image) + '" alt="' + escapeHtml(video.alt || 'Video tour') + '">' +
        '<span class="rl-mosaic__play" aria-hidden="true">▶</span>' +
        '<span class="rl-mosaic__label">Video tour</span></button>'
      : '';
    return `
      <div class="rl-mosaic" id="rl-gallery">
        ${tiles}${videoTile}
        <button type="button" class="rl-mosaic__all" data-open-gallery="${escapeHtml(l.id)}" data-gallery-index="0">
          Show all ${items.length} photos &amp; video
        </button>
      </div>`;
  }

  function renderVideoTour(l) {
    if (!l.video || !l.video.src) return '';
    const items = listingMedia(l);
    const videoIndex = Math.max(0, items.findIndex((x) => x.kind === 'video'));
    return `
      <section class="rl-block rl-tour">
        <div class="rl-tour__head">
          <h2>Video tour</h2>
          <button type="button" class="btn btn--outline" data-open-gallery="${escapeHtml(l.id)}" data-gallery-index="${videoIndex}">Open in gallery</button>
        </div>
        <div class="rl-tour__frame">
          <video poster="${escapeHtml(l.video.poster || l.image)}" controls preload="metadata" playsinline src="${l.video.src}"></video>
        </div>
        <p>${escapeHtml(l.video.caption || 'Watch the host walk the bedroom, bath, and shared kitchen.')} Book a live tour before you send a deposit.</p>
      </section>`;
  }

  const MENU_HEROES = {
    room: {
      crumb: 'Rooms',
      kicker: 'Private bedrooms · 30-day minimum',
      title: 'Rooms you can see before you tour',
      blurb: 'A real bedroom with a door, named housemates, a photo gallery, and a video walkthrough. Rent is all-in.',
      film: 'See the rooms',
      filmSub: 'Bedroom, bath, kitchen, and a host video — not a single hero crop.',
      cta: 'Browse rooms',
      jump: '#listings'
    },
    coliving: {
      crumb: 'Co-living',
      kicker: 'Designed buildings · per-room inventory',
      title: 'Co-living with a real room list',
      blurb: 'Cleaning, coworking, and events are on the page. Inventory is per room — not a mystery house share.',
      film: 'See the buildings',
      filmSub: 'Studio-style and classic rooms in operated houses across the U.S. and Europe.',
      cta: 'Browse co-living',
      jump: '#listings'
    },
    furnished: {
      crumb: 'Furnished',
      kicker: 'Move in with a suitcase · 30-day minimum',
      title: 'Furnished homes with an inventory',
      blurb: 'Bed, desk, and kitchen tools are listed. No mattress-on-the-floor month. Ideal for relocations and contracts.',
      film: 'See the homes',
      filmSub: 'Inventoried apartments you can take for a month or a year.',
      cta: 'Browse furnished',
      jump: '#listings'
    },
    'short-term': {
      crumb: '1-month+',
      kicker: 'Mid-term housing · never hotel nights',
      title: 'One month or more — a home, not a booking',
      blurb: 'Short-term here starts at 30 days. Utilities and wifi sit in All-in rent. Built for pilots, contracts, and apartment-hunt buffers.',
      film: 'See 1-month+ stays',
      filmSub: 'Furnished mid-term homes in 69 markets.',
      cta: 'Browse 1-month+',
      jump: '#listings'
    },
    'lease-break': {
      crumb: 'Lease-break',
      kicker: 'Takeovers · assignment vs sublet',
      title: 'Take the rest of the lease',
      blurb: 'See the Lease Clock, months left, and whether it is an assignment or a sublet. It lists on the same terms as every other home.',
      film: 'See takeovers',
      filmSub: 'Remaining terms with takeover math before you send money.',
      cta: 'Browse lease-breaks',
      jump: '#listings'
    },
    cities: {
      crumb: 'Cities',
      kicker: '69 markets · U.S. + Canada + Europe',
      title: 'Pick a city, then a stay type',
      blurb: 'Rooms, co-living, furnished apartments, 1-month+ stays, and lease-breaks in New York, London, Paris, Dublin, Berlin, and 64 more markets.',
      film: 'Featured markets',
      filmSub: 'Jump into a city directory, then filter by stay type.',
      cta: 'Browse all cities',
      jump: '#rl-city-directory'
    },
    match: {
      crumb: 'Match',
      kicker: 'Stay DNA · two minutes',
      title: 'Rank homes by how they fit you',
      blurb: 'City, budget, stay length, and house energy. We score inventory in your browser — no credit pull, no unlock wall.',
      film: 'Homes we can rank',
      filmSub: 'Rooms, co-living, furnished, and takeovers — scored against your Stay DNA.',
      cta: 'Build my Stay DNA',
      jump: '#rl-match'
    }
  };

  function menuHeroKey() {
    const type = document.body.dataset.type || state.type || '';
    if (MENU_HEROES[type]) return type;
    const page = pageName();
    if (MENU_HEROES[page]) return page;
    return '';
  }

  function menuHeroStrip(active) {
    const items = [
      ['room', 'Rooms', 'rooms.html'],
      ['coliving', 'Co-living', 'coliving.html'],
      ['furnished', 'Furnished', 'furnished.html'],
      ['short-term', '1-month+', 'short-term.html'],
      ['lease-break', 'Lease-break', 'lease-break.html'],
      ['cities', 'Cities', 'cities.html'],
      ['match', 'Match', 'match.html']
    ];
    const base = assetBase();
    return '<nav class="rl-hero-menus" aria-label="Stay menus">' + items.map(([key, label, href]) =>
      '<a class="rl-hero-menus__link' + (key === active ? ' is-on' : '') + '" href="' + base + href + '">' + label + '</a>'
    ).join('') + '</nav>';
  }

  function renderMenuHero() {
    const key = menuHeroKey();
    if (!key) return;
    const copy = MENU_HEROES[key];
    const listings = DATA.listings || [];
    const typePool = ['room', 'coliving', 'furnished', 'short-term', 'lease-break'].includes(key)
      ? listings.filter((l) => l.housingType === key)
      : listings.filter((l) => l.featured).concat(listings);
    const pool = typePool.filter((l, i, arr) => arr.findIndex((x) => x.id === l.id) === i);
    if (!pool.length) return;
    const featured = pool.filter((l) => l.cityId === 'nyc' || l.featured).concat(pool)
      .filter((l, i, arr) => arr.findIndex((x) => x.id === l.id) === i)
      .slice(0, 8);
    const lead = pool.find((l) => l.video && l.video.src) || featured[0] || pool[0];
    const leadMedia = listingMedia(lead);
    const videoIndex = Math.max(0, leadMedia.findIndex((x) => x.kind === 'video'));
    const count = key === 'cities' ? (DATA.cities || []).length : pool.length;
    const html = `
      <section class="rl-media-hero" id="rl-menu-hero">
        ${lead.video && lead.video.src
          ? '<video class="rl-media-hero__video" autoplay muted loop playsinline poster="' + lead.image + '" src="' + lead.video.src + '"></video>'
          : '<img class="rl-media-hero__video" src="' + lead.image + '" alt="' + escapeHtml(lead.imageAlt || copy.title) + '">'}
        <div class="rl-media-hero__shade"></div>
        <div class="rl-media-hero__copy container">
          <nav class="rl-crumb rl-crumb--light" aria-label="Breadcrumb"><a href="${assetBase()}index.html">Home</a> / ${copy.crumb}</nav>
          ${menuHeroStrip(key)}
          <p class="rl-kicker rl-kicker--light">${copy.kicker}</p>
          <h1>${copy.title}</h1>
          <p>${copy.blurb}</p>
          <div class="rl-media-hero__actions">
            <a class="btn btn--primary" href="${copy.jump}">${copy.cta}${key !== 'match' && key !== 'cities' ? ' · ' + count : ''}</a>
            ${lead.video && lead.video.src
              ? '<button type="button" class="btn btn--on-dark" data-open-gallery="' + escapeHtml(lead.id) + '" data-gallery-index="' + videoIndex + '">Play video tour</button>'
              : '<a class="btn btn--on-dark" href="' + listingHref(lead) + '">View a featured stay</a>'}
          </div>
        </div>
      </section>
      <section class="rl-room-film container">
        <div class="rl-room-film__head">
          <h2>${copy.film}</h2>
          <p>${copy.filmSub}</p>
        </div>
        <div class="rl-room-film__grid">
          ${featured.map((l) => {
            const photo = listingMedia(l).find((x) => x.kind === 'photo') || { src: l.image };
            return '<a class="rl-room-film__card" href="' + listingHref(l) + '">' +
              '<img src="' + photo.src + '" alt="' + escapeHtml(l.imageAlt || l.title) + '" width="900" height="700" loading="lazy">' +
              (l.video ? '<span class="rl-room-film__vid">Video</span>' : '') +
              '<span class="rl-room-film__cap">' + escapeHtml(l.title) + ' · ' + escapeHtml(l.cityName) + '</span></a>';
          }).join('')}
        </div>
      </section>`;
    let mount = $('#rl-page-hero') || $('#rl-rooms-media');
    if (!mount) {
      const main = $('#main');
      if (!main) return;
      mount = document.createElement('div');
      mount.id = 'rl-page-hero';
      const after = $('#listings') || $('#rl-city-directory') || $('#rl-match') || main.firstElementChild;
      if (after && after.parentElement === main) main.insertBefore(mount, after);
      else if (after && after.closest('section')) main.insertBefore(mount, after.closest('section'));
      else main.insertBefore(mount, main.firstElementChild);
    }
    mount.innerHTML = html;
    const oldHero = $('.page-hero');
    if (oldHero) oldHero.hidden = true;
  }
  function renderRoomsShowcase() { renderMenuHero(); }
  function allIn(l) { return DATA.allIn ? DATA.allIn(l) : (l.allIn || l.price); }
  function daysUntil(iso) {
    if (!iso) return null;
    return Math.round((new Date(iso + 'T12:00:00') - new Date('2026-09-07T12:00:00')) / 86400000);
  }
  function formatDate(iso) {
    if (!iso) return 'Flexible';
    return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function savedIds() { return read(STORE.saved, []); }
  function compareIds() { return read(STORE.compare, []).slice(0, 3); }
  function session() { return read(STORE.session, null); }
  function profile() { return read(STORE.profile, null); }

  function toast(msg) {
    let el = $('#rl-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'rl-toast';
      el.className = 'rl-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('is-on');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('is-on'), 2600);
  }

  function iconPin() {
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
  }

  function pageName() {
    return document.body.dataset.page || 'home';
  }

  /* Locales that have a built tree under their own directory. Kept in step
     with locales/*.json and with the list in rentleaks-i18n.js. */
  const LOCALE_DIRS = ['fr', 'de', 'it'];

  /* How far below the site root this page sits, counted rather than matched.
     The old version tested a fixed list of folder names, which was already
     one folder away from being wrong and became wrong the moment /fr/ and
     /fr/cities/ existed — two different depths that no single regex covers. */
  function assetBase() {
    const parts = (window.location.pathname || '/').split('/').filter(Boolean);
    const last = parts[parts.length - 1] || '';
    const depth = /\.[a-z0-9]+$/i.test(last) ? parts.length - 1 : parts.length;
    return depth > 0 ? '../'.repeat(depth) : '';
  }

  function localeDir() {
    const first = (window.location.pathname || '/').split('/').filter(Boolean)[0] || '';
    return LOCALE_DIRS.indexOf(first) !== -1 ? first + '/' : '';
  }

  /* Where a page that HAS a translation lives. Assets and the pages that are
     English-only — listings, enterprise, hire-a-broker — use assetBase()
     instead, so a French visitor follows those links out of /fr/ rather than
     into a URL that was never built. */
  function localeBase() {
    const dir = localeDir();
    if (!dir) return assetBase();
    // Already inside the locale: climb to the locale's own root, not the
    // site root and back down again.
    const parts = (window.location.pathname || '/').split('/').filter(Boolean);
    const last = parts[parts.length - 1] || '';
    const depth = /\.[a-z0-9]+$/i.test(last) ? parts.length - 1 : parts.length;
    return depth > 1 ? '../'.repeat(depth - 1) : '';
  }

  function listingHref(listing) {
    if (listing && listing.path) return assetBase() + listing.path;
    return assetBase() + 'listing.html?id=' + encodeURIComponent(listing && listing.id ? listing.id : '');
  }

  function cityHref(city) {
    const slug = city.slug || (DATA.slugify ? DATA.slugify(city.name) : city.id);
    return localeBase() + 'cities/' + slug + '.html';
  }

  function typeHref(typeId) {
    const files = DATA.typeFiles || {};
    return localeBase() + (files[typeId] || ('rent.html?type=' + encodeURIComponent(typeId)));
  }

  function navLink(href, label, key) {
    const page = pageName();
    const type = params().get('type') || params().get('category') || document.body.dataset.type || '';
    const typeKeys = { room: 1, coliving: 1, furnished: 1, 'short-term': 1, aparthotel: 1, 'lease-break': 1 };
    const active = page === key || (typeKeys[key] && type === key);
    return '<li><a href="' + href + '" class="nav__link' + (active ? ' nav__link--active' : '') + '">' + label + '</a></li>';
  }


  function injectChrome() {
    const saved = savedIds().length;
    const user = session();
    const base = localeBase();   // pages that exist in every locale
    const rbase = assetBase();   // assets, and the pages that are English-only
    const headerHost = $('#rl-header');
    if (headerHost) {
      headerHost.innerHTML = `
        <header class="header">
          <div class="header__container">
            <a href="${base}index.html" class="logo" aria-label="RentLeaks home">
              ${RL_LOGO}
            </a>
            <nav class="nav" id="rl-nav" aria-label="Main navigation">
              <ul class="nav__list">
                ${navLink(base + 'rooms.html', 'Rooms', 'room')}
                ${navLink(base + 'coliving.html', 'Co-living', 'coliving')}
                ${navLink(base + 'furnished.html', 'Furnished', 'furnished')}
                ${navLink(base + 'short-term.html', '1-month+', 'short-term')}
                ${navLink(base + 'aparthotel.html', 'Aparthotel', 'aparthotel')}
                ${navLink(base + 'lease-break.html', 'Lease-break', 'lease-break')}
                ${navLink(base + 'cities.html', 'Cities', 'cities')}
                ${navLink(base + 'operators.html', 'Operators', 'operators')}
                ${navLink(base + 'match.html', 'Stay DNA', 'match')}
                ${navLink(rbase + 'hire-a-broker/', 'Hire a broker', 'hire-a-broker')}
                ${navLink(rbase + 'enterprise/', 'Enterprise', 'enterprise')}
              </ul>
            </nav>
            <div class="header__actions">
              <button type="button" class="header__link js-cmd" aria-label="Search everything">
                <span class="js-cmd__label">Search everything</span><kbd>⌘K</kbd>
              </button>
              <a href="${rbase}saved.html" class="header__link">Saved${saved ? ' <span class="rl-count">' + saved + '</span>' : ''}</a>
              <a href="${rbase}hire-a-broker/" class="header__link header__link--hire${pageName() === 'hire-a-broker' ? ' is-on' : ''}">Hire a broker</a>
              <a href="${rbase}enterprise/" class="header__link header__link--ent${pageName() === 'enterprise' ? ' is-on' : ''}">For owners</a>
              <a href="${appHref('/list', base + 'list.html')}" class="header__link">List a place</a>
              <label class="cur-select" title="Display currency">
                <span class="sr-only">Display currency</span>
                <select class="js-currency" aria-label="Display currency">
                  ${CURRENCIES.map((c) => '<option value="' + c + '"' + (c === displayCurrency() ? ' selected' : '') + '>' + c + '</option>').join('')}
                </select>
              </label>
              <button type="button" class="theme-toggle js-theme" aria-label="Switch colour theme">${iconSun()}${iconMoon()}</button>
              ${user
                ? '<a href="' + rbase + 'saved.html" class="btn btn--primary btn--sm">' + escapeHtml(user.name.split(' ')[0]) + '</a>'
                : '<a href="' + appHref('/login', base + 'index.html') + '" class="btn btn--primary btn--sm' + (appOrigin() ? '' : ' js-modal-trigger') + '" data-modal="auth">Sign in</a>'}
              <button class="nav-toggle" aria-label="Toggle navigation" aria-expanded="false" aria-controls="rl-nav"><span></span><span></span><span></span></button>
            </div>
          </div>
        </header>`;
    }

    const footerHost = $('#rl-footer');
    if (footerHost) {
      const typeLinks = (DATA.housingTypes || []).map((t) => '<li><a href="' + base + (t.href || typeHref(t.id)) + '">' + t.label + '</a></li>').join('');
      const featuredCities = (DATA.cities || []).filter((c) => c.featured);
      const cityLinks = featuredCities.filter((c) => (c.country || 'US') === 'US').slice(0, 4)
        .concat(featuredCities.filter((c) => (c.country || 'US') !== 'US').slice(0, 5))
        .map((c) => '<li><a href="' + cityHref(c) + '">' + c.name + '</a></li>').join('');
      footerHost.innerHTML = `
        <footer class="footer">
          <div class="container">
            <div class="newsletter">
              <div class="newsletter__inner">
                <div>
                  <h3 class="newsletter__title">Get the next flexible home first</h3>
                  <p class="newsletter__desc">Rooms, co-living, furnished, 1-month+ stays and lease takeovers — the moment they list. Never hotel nights.</p>
                </div>
                <form class="newsletter__form" action="#" aria-label="Alert signup">
                  <input type="email" class="newsletter__input" placeholder="you@example.com" required aria-label="Email address">
                  <button type="submit" class="btn btn--primary">Start alerts</button>
                </form>
              </div>
            </div>
            <div class="footer__grid">
              <div class="footer__brand">
                <a href="${base}index.html" class="logo logo--footer" aria-label="RentLeaks home">${RL_LOGO}</a>
                <p class="footer__tagline">Flexible housing, priced honestly. Every price all-in, every stay 30 days or more.</p>
              </div>
              <nav class="footer__nav" aria-label="Footer">
                <div class="footer__col"><h4>Find</h4><ul>${typeLinks}<li><a href="${base}match.html">Stay DNA match</a></li></ul></div>
                <div class="footer__col"><h4>Cities</h4><ul>${cityLinks}<li><a href="${base}cities.html">All ${(DATA.cities || []).length} markets</a></li></ul></div>
                <div class="footer__col"><h4>Hosts</h4><ul>
                  <li><a href="${base}list.html?kind=lease-break">Post a lease-break</a></li>
                  <li><a href="${base}list.html?kind=room">List a room</a></li>
                  <li><a href="${base}list.html?kind=coliving">Co-living operators</a></li>
                  <li><a href="${base}operators.html">Operator boutiques</a></li>
                  <li><a href="${base}professionals.html">Plans &amp; tools</a></li>
                </ul></div>
                <div class="footer__col"><h4>Enterprise</h4><ul>
                  <li><a href="${rbase}enterprise/">For building owners</a></li>
                  <li><a href="${rbase}enterprise/brokerage.html">Brokerage &amp; leasing</a></li>
                  <li><a href="${rbase}enterprise/marketing.html">Marketing &amp; virtual tours</a></li>
                  <li><a href="${rbase}enterprise/management.html">Property management</a></li>
                  <li><a href="${rbase}enterprise/owners.html">Out-of-state owners</a></li>
                </ul></div>
                <div class="footer__col"><h4>Broker network</h4><ul>
                  <li><a href="${rbase}hire-a-broker/">Hire a broker</a></li>
                  <li><a href="${rbase}hire-a-broker/#how">How it works</a></li>
                  <li><a href="${rbase}hire-a-broker/agents.html">Tenant leads for agents</a></li>
                  <li><a href="${rbase}hire-a-broker/guide.html">Free guides</a></li>
                  <li><a href="${rbase}hire-a-broker/agents.html#portal">Partner portal</a></li>
                </ul></div>
                <div class="footer__col"><h4>Company</h4><ul>
                  <li><a href="${base}faq.html">FAQ</a></li>
                  <li><a href="${base}contact.html">Contact</a></li>
                  <li><a href="${base}privacy.html">Privacy</a></li>
                  <li><a href="${base}terms.html">Terms</a></li>
                  <li><a href="${rbase}llms.txt">AI index</a></li>
                </ul></div>
              </nav>
            </div>
            <div class="footer__bottom">
              <p>&copy; 2026 RentLeaks. Fair Housing applies in every market we list.</p>
              <p>Short-term means 30 days or more — homes, not hotel nights.</p>
            </div>
          </div>
        </footer>`;
    }

    if (!$('#modal-auth')) {
      const wrap = document.createElement('div');
      wrap.innerHTML = `
        <div class="modal-overlay" id="modal-auth" aria-hidden="true">
          <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-auth-title">
            <button type="button" class="modal__close js-modal-close" aria-label="Close">&times;</button>
            <h2 id="modal-auth-title" class="modal__title">Your renter passport</h2>
            <p class="modal__subtitle">One profile. Save homes, compare, and apply without retyping. Stored in this browser.</p>
            <div class="modal-tabs" role="tablist">
              <button type="button" class="modal-tab is-active" data-panel="signin">Sign in</button>
              <button type="button" class="modal-tab" data-panel="signup">Create passport</button>
            </div>
            <div id="panel-signin" class="modal-panel is-active">
              <form class="form js-auth-form" data-action="signin">
                <div class="form-group"><label for="signin-email">Email</label><input type="email" id="signin-email" name="email" class="form-input" required placeholder="you@example.com"></div>
                <div class="form-group"><label for="signin-password">Password</label><input type="password" id="signin-password" name="password" class="form-input" required></div>
                <button type="submit" class="btn btn--primary btn--block">Sign in</button>
              </form>
            </div>
            <div id="panel-signup" class="modal-panel">
              <form class="form js-auth-form" data-action="signup">
                <div class="form-group"><label for="signup-name">Name</label><input type="text" id="signup-name" name="name" class="form-input" required></div>
                <div class="form-group"><label for="signup-email">Email</label><input type="email" id="signup-email" name="email" class="form-input" required></div>
                <div class="form-group"><label for="signup-password">Password</label><input type="password" id="signup-password" name="password" class="form-input" required minlength="8"></div>
                <button type="submit" class="btn btn--primary btn--block">Create passport</button>
              </form>
            </div>
          </div>
        </div>
        <div class="rl-compare-tray" id="rl-compare-tray" hidden></div>
        <div class="rl-cmd" id="rl-cmd" hidden>
          <div class="rl-cmd__panel" role="dialog" aria-modal="true" aria-label="Search everything">
            <input type="search" id="rl-cmd-input" class="rl-cmd__input" placeholder="Jump to a city, stay type, or home…" autocomplete="off">
            <div id="rl-cmd-results" class="rl-cmd__results"></div>
            <div class="rl-cmd__hint"><span>↑↓ to move</span><span>↵ to open</span><span>esc to close</span></div>
          </div>
        </div>`;
      document.body.appendChild(wrap);
    }
    renderCompareTray();
  }
  function filterListings(override) {
    const s = Object.assign({}, state, override || {});
    let list = (DATA.listings || []).filter((l) => l.type !== 'sale');

    if (s.type) list = list.filter((l) => l.housingType === s.type || (l.categories || []).includes(s.type));
    if (s.city) {
      const city = cityMeta(s.city);
      list = list.filter((l) => l.cityId === s.city || (city && l.cityName === city.name));
    }
    if (s.location) {
      const q = s.location.toLowerCase();
      list = list.filter((l) =>
        (l.location || '').toLowerCase().includes(q) ||
        (l.address || '').toLowerCase().includes(q) ||
        (l.neighborhood || '').toLowerCase().includes(q) ||
        (l.cityName || '').toLowerCase().includes(q) ||
        (l.title || '').toLowerCase().includes(q)
      );
    }
    // Budgets are typed in the display currency; listings are stored in their
    // own. Compare on the converted figure, never the raw one.
    if (s.priceMin) list = list.filter((l) => allInDisplay(l) >= Number(s.priceMin));
    if (s.priceMax) list = list.filter((l) => allInDisplay(l) <= Number(s.priceMax));
    if (s.beds) list = list.filter((l) => (l.beds || 0) >= Number(s.beds));
    if (s.minStay) list = list.filter((l) => (l.minStayMonths || 1) <= Number(s.minStay));
    if (s.moveIn) list = list.filter((l) => !l.availableFrom || l.availableFrom <= s.moveIn);
    if (s.furnished === 'fully') list = list.filter((l) => l.furnishedLevel === 'fully');
    if (s.pets === 'yes') list = list.filter((l) => l.pets && l.pets !== 'none');
    if (s.privateBath) list = list.filter((l) => l.privateBath);
    if (s.workspace) list = list.filter((l) => l.workplaceReady);
    if (s.noFee) list = list.filter((l) => l.noFee);
    if (s.utilitiesIn) list = list.filter((l) => (l.utilitiesIncluded || []).includes('utilities') || (l.fees && l.fees.utilities === 0));
    if (s.verified) list = list.filter((l) => l.verified);

    if (s.sort === 'price-asc') list.sort((a, b) => allInDisplay(a) - allInDisplay(b));
    else if (s.sort === 'price-desc') list.sort((a, b) => allInDisplay(b) - allInDisplay(a));
    else if (s.sort === 'move-in') list.sort((a, b) => String(a.availableFrom).localeCompare(String(b.availableFrom)));
    else if (s.sort === 'match' && read(STORE.match, null)) {
      const pref = read(STORE.match, null);
      list.sort((a, b) => scoreListing(b, pref) - scoreListing(a, pref));
    } else list.sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));

    return list;
  }

  function scoreListing(l, pref) {
    if (!pref) return 0;
    let score = 40;
    if (pref.city && l.cityId === pref.city) score += 22;
    if (pref.types && pref.types.includes(l.housingType)) score += 18;
    if (pref.budget && allInDisplay(l) <= Number(pref.budget)) score += 12;
    else if (pref.budget && allInDisplay(l) > Number(pref.budget)) score -= 16;
    if (pref.stay && (l.minStayMonths || 1) <= Number(pref.stay)) score += 8;
    if (pref.workspace && l.workplaceReady) score += 6;
    if (pref.pets === 'yes' && l.pets !== 'none') score += 6;
    if (pref.privateBath && l.privateBath) score += 6;
    if (pref.vibe && l.vibe === pref.vibe) score += 8;
    if (l.verified) score += 4;
    if (l.noFee) score += 3;
    return Math.max(0, Math.min(99, score));
  }


  function renderListing(listing) {
    const t = typeMeta(listing.housingType);
    const saved = savedIds().includes(listing.id);
    const compared = compareIds().includes(listing.id);
    const pref = read(STORE.match, null);
    const match = pref ? scoreListing(listing, pref) : null;
    const clock = listing.housingType === 'lease-break' && listing.remainingMonths
      ? '<span class="rl-clock">' + listing.remainingMonths + ' mo left</span>'
      : '';
    const extras = [
      listing.verified ? 'Verified' : null,
      listing.noFee ? 'No fee' : null,
      listing.furnishedLevel === 'fully' ? 'Furnished' : null,
      listing.workplaceReady ? 'Workspace' : null
    ].filter(Boolean).slice(0, 3).join(' · ');
    const media = listingMedia(listing);
    const shotCount = media.filter((x) => x.kind === 'photo').length;
    const hasVideo = media.some((x) => x.kind === 'video');
    const id = escapeHtml(listing.id);
    const href = listingHref(listing);

    return `
      <article class="listing-card animate-on-scroll" data-id="${id}">
        <div class="listing-card__img-wrap">
          <div class="listing-card__img">
            <img class="listing-card__photo" src="${listing.image}" alt="${escapeHtml(listing.imageAlt || listing.title + ' in ' + listing.location)}" width="1400" height="933" loading="lazy" decoding="async">
            <span class="listing-card__badge">${escapeHtml(t.short)}</span>
            ${clock}
            ${match != null ? '<span class="rl-match-pill">' + match + '% fit</span>' : ''}
            ${hasVideo ? '<span class="listing-card__vid">Video</span>' : ''}
            ${shotCount > 1 ? '<span class="listing-card__shots">' + shotCount + ' photos</span>' : ''}
          </div>
          <button type="button" class="listing-card__save${saved ? ' listing-card__save--saved' : ''}" data-save="${id}" aria-pressed="${saved}" aria-label="${saved ? 'Remove from saved' : 'Save this home'}">
            <svg viewBox="0 0 24 24" fill="${saved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          </button>
        </div>
        <div class="listing-card__body">
          <p class="listing-card__price">${money(allIn(listing), listing)}<span class="listing-card__period">all-in /mo</span>${leakChip(listing)}</p>
          <button type="button" class="rl-allin-live" data-fees="${id}" aria-label="See what makes up this price">Base ${money(listing.price, listing)} + fees</button>
          <h3 class="listing-card__title"><a href="${href}" class="listing-card__link">${escapeHtml(listing.title)}</a></h3>
          <p class="listing-card__address">${iconPin()}${escapeHtml(listing.location)}</p>
          <p class="listing-card__specs">${escapeHtml(listing.specs)} · from ${formatDate(listing.availableFrom)}</p>
          ${extras ? '<p class="rl-card-meta">' + extras + '</p>' : ''}
          <button type="button" class="rl-compare-btn${compared ? ' is-on' : ''}" data-compare="${id}" aria-pressed="${compared}">${compared ? 'Added' : 'Compare'}</button>
        </div>
      </article>`;
  }
  function listingCoords(listing) {
    if (listing && Number.isFinite(listing.lat) && Number.isFinite(listing.lng)) {
      return { lat: listing.lat, lng: listing.lng };
    }
    const city = listing ? cityMeta(listing.cityId) : null;
    if (!city || !Number.isFinite(city.lat)) return null;
    const seed = (listing.id || '').length;
    return {
      lat: city.lat + ((seed % 80) - 40) / 1000,
      lng: city.lng + ((seed % 80) - 40) / 800
    };
  }

  function ensureLeaflet(done) {
    if (window.L) { done(); return; }
    if (document.getElementById('rl-leaflet-js')) {
      document.getElementById('rl-leaflet-js').addEventListener('load', done, { once: true });
      return;
    }
    const css = document.createElement('link');
    css.id = 'rl-leaflet-css';
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);
    const script = document.createElement('script');
    script.id = 'rl-leaflet-js';
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = done;
    document.body.appendChild(script);
  }


  function ensureBrowseLayout() {
    const grid = $('#listings-grid');
    if (!grid) return;
    if ($('#rl-browse')) return;

    const container = grid.closest('.container') || grid.parentNode;
    const adv = $('.rl-adv');
    const top = $('.listings__top');
    const empty = $('#listings-empty');
    const suggest = $('#rl-suggest');

    const browse = document.createElement('div');
    browse.className = 'rl-browse';
    browse.id = 'rl-browse';

    const side = document.createElement('aside');
    side.className = 'rl-side';
    side.id = 'rl-filters';
    side.setAttribute('aria-label', 'Filters');
    side.innerHTML = '<div class="rl-side__head"><span class="rl-side__title">Refine</span>' +
      '<button type="button" class="rl-side__clear" data-chip="__all">Reset</button></div>';

    const typeFs = document.createElement('fieldset');
    typeFs.className = 'rl-fieldset';
    typeFs.innerHTML = '<legend>Stay type</legend><div class="rl-optlist" id="rl-opt-type">' +
      '<button type="button" class="rl-opt" data-set-type="">Everything</button>' +
      (DATA.housingTypes || []).map((t) => {
        const n = (DATA.listings || []).filter((l) => l.housingType === t.id).length;
        return '<button type="button" class="rl-opt" data-set-type="' + t.id + '">' + escapeHtml(t.label) + '<span>' + n + '</span></button>';
      }).join('') + '</div>';
    side.appendChild(typeFs);

    const priceFs = document.createElement('fieldset');
    priceFs.className = 'rl-fieldset';
    priceFs.innerHTML = '<legend>All-in budget / month</legend>' +
      '<div class="rl-range">' +
      '<label class="sr-only" for="rail-min">Minimum all-in</label>' +
      '<input type="number" id="rail-min" min="0" step="50" placeholder="Min" inputmode="numeric">' +
      '<span aria-hidden="true">–</span>' +
      '<label class="sr-only" for="rail-max">Maximum all-in</label>' +
      '<input type="number" id="rail-max" min="0" step="50" placeholder="Max" inputmode="numeric">' +
      '</div>' +
      '<div class="rl-optrow" id="rl-opt-budget">' +
      [1500, 2500, 4000].map((v) => '<button type="button" class="rl-opt rl-opt--sm" data-set-max="' + v + '">Under ' + money(v) + '</button>').join('') +
      '</div>';
    side.appendChild(priceFs);

    const bedFs = document.createElement('fieldset');
    bedFs.className = 'rl-fieldset';
    bedFs.innerHTML = '<legend>Bedrooms</legend><div class="rl-optrow" id="rl-opt-beds">' +
      [['', 'Any'], ['1', '1+'], ['2', '2+'], ['3', '3+']].map((b) =>
        '<button type="button" class="rl-opt rl-opt--sm" data-set-beds="' + b[0] + '">' + b[1] + '</button>').join('') +
      '</div>';
    side.appendChild(bedFs);

    const stayFs = document.createElement('fieldset');
    stayFs.className = 'rl-fieldset';
    stayFs.innerHTML = '<legend>Stay length</legend><div class="rl-optrow" id="rl-opt-stay">' +
      [['', 'Any'], ['1', '1 mo'], ['3', '3 mo'], ['6', '6 mo'], ['12', '12 mo']].map((b) =>
        '<button type="button" class="rl-opt rl-opt--sm" data-set-stay="' + b[0] + '">' + b[1] + '</button>').join('') +
      '</div>';
    side.appendChild(stayFs);

    const fs = document.createElement('fieldset');
    fs.className = 'rl-fieldset';
    fs.innerHTML = '<legend>Must-haves</legend>';
    if (adv) { adv.parentNode.removeChild(adv); fs.appendChild(adv); }
    side.appendChild(fs);

    const done = document.createElement('div');
    done.className = 'rl-side__done';
    done.innerHTML = '<button type="button" class="btn btn--primary btn--block js-filter-done">Show homes</button>';
    side.appendChild(done);

    const results = document.createElement('div');
    results.className = 'rl-results';
    results.id = 'rl-results';

    const chips = document.createElement('div');
    chips.className = 'rl-chips';
    chips.id = 'rl-chips';
    chips.hidden = true;

    container.insertBefore(browse, top || grid);
    browse.appendChild(side);
    browse.appendChild(results);
    if (top) results.appendChild(top);
    results.appendChild(chips);
    results.appendChild(grid);
    if (empty) results.appendChild(empty);
    if (suggest) results.appendChild(suggest);

    const map = document.createElement('div');
    map.id = 'rl-browse-map';
    map.className = 'rl-map';
    map.hidden = true;
    browse.appendChild(map);

    const fab = document.createElement('button');
    fab.type = 'button';
    fab.className = 'rl-filter-fab js-filter-open';
    fab.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M3 6h18M7 12h10M10 18h4"/></svg> Filters';
    document.body.appendChild(fab);
  }

  function renderBrowseMap(list) {
    const el = $('#rl-browse-map');
    if (!el) return;
    const on = state.view === 'map';
    el.hidden = !on;
    const browse = $('#rl-browse');
    if (browse) browse.classList.toggle('rl-browse--map', on);
    if (!on) return;
    ensureLeaflet(function () {
      if (!browseMap) {
        browseMap = window.L.map(el, { scrollWheelZoom: false }).setView([40.71, -74], 3);
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap', maxZoom: 18
        }).addTo(browseMap);
      }
      browseMarkers.forEach((marker) => marker.remove());
      browseMarkers = [];
      const bounds = [];
      list.slice(0, 160).forEach((listing) => {
        const geo = listingCoords(listing);
        if (!geo) return;
        bounds.push([geo.lat, geo.lng]);
        const icon = window.L.divIcon({
          className: '',
          html: '<span class="rl-price-marker">' + money(allIn(listing), listing) + '</span>',
          iconSize: [70, 26],
          iconAnchor: [35, 26]
        });
        const marker = window.L.marker([geo.lat, geo.lng], { icon: icon }).addTo(browseMap);
        marker.bindPopup(
          '<a class="rl-pop" href="' + listingHref(listing) + '">' +
          '<img src="' + listing.image + '" alt="" loading="lazy">' +
          '<span class="rl-pop__b"><span class="rl-pop__p">' + money(allIn(listing), listing) + ' all-in</span>' +
          '<span class="rl-pop__t">' + escapeHtml(listing.title) + '</span></span></a>'
        );
        browseMarkers.push(marker);
      });
      if (bounds.length === 1) browseMap.setView(bounds[0], 13);
      else if (bounds.length > 1) browseMap.fitBounds(bounds, { padding: [32, 32], maxZoom: 12 });
      setTimeout(function () { browseMap.invalidateSize(); }, 80);
    });
  }
  function hydrateListingMap() {
    const id = document.body.dataset.listingId || params().get('id');
    const listing = listingById(id);
    const geo = listingCoords(listing);
    if (!listing || !geo) return;
    let el = $('#rl-listing-map');
    if (!el) {
      const host = $('.rl-detail') || $('#rl-detail') || $('#main');
      if (!host) return;
      const section = document.createElement('section');
      section.className = 'rl-block';
      section.innerHTML = '<h2>On the map</h2><div id="rl-listing-map" class="rl-map rl-map--detail"></div>';
      host.appendChild(section);
      el = $('#rl-listing-map');
    }
    ensureLeaflet(function () {
      const map = window.L.map(el).setView([geo.lat, geo.lng], 14);
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);
      window.L.marker([geo.lat, geo.lng]).addTo(map)
        .bindPopup(escapeHtml(listing.title) + '<br>' + money(allIn(listing), listing) + ' all-in /mo');
    });
  }


  function renderListings() {
    // When the API is reachable, filtering/sorting/paging happen in Postgres
    // rather than over a 482-item array in the browser. The baked catalog
    // still renders first so there is never an empty frame.
    if (apiEnabled() && $('#listings-grid')) {
      const token = (renderListings._token = (renderListings._token || 0) + 1);
      window.RLData.query(state, state.page, PAGE_SIZE)
        .then((r) => {
          if (token !== renderListings._token) return; // a newer query won
          liveResult = r;
          markLiveState(true);
          paintListings();
        })
        .catch(() => {
          liveResult = null;
          markLiveState(false);
          paintListings();
        });
    }
    paintListings();
  }

  function paintListings() {
    const grid = $('#listings-grid');
    const empty = $('#listings-empty');
    const countEl = $('#listings-count');
    const usingLive = !!liveResult;
    const list = usingLive ? liveResult.items : filterListings();
    const city = state.city ? (cityMeta(state.city) || {}).name : '';
    const type = state.type ? typeMeta(state.type).label : 'flexible homes';
    const where = city || state.location || 'the U.S. + Canada + Europe';
    const total = usingLive ? liveResult.total : list.length;
    if (countEl) countEl.textContent = total.toLocaleString() + ' ' + type.toLowerCase() + ' in ' + where;
    const rc = $('#trust-rent-count');
    const cc = $('#trust-city-count');
    if (rc) rc.textContent = (DATA.listings || []).length.toLocaleString();
    if (cc) cc.textContent = String((DATA.cities || []).length);
    if (!grid) return;

    ensureBrowseLayout();
    renderChips();
    paintRail();
    grid.classList.toggle('is-list', state.view === 'list');
    $$('[data-view]').forEach((btn) => btn.classList.toggle('is-on', btn.dataset.view === state.view));

    if (!grid.dataset.painted) {
      grid.innerHTML = skeletonCards(6);
      grid.dataset.painted = '1';
    }
    let shown;
    if (usingLive) {
      // The API returns one page; accumulate them so "Show more" appends
      // instead of replacing.
      const acc = (paintListings._acc = state.page === 1 ? [] : (paintListings._acc || []));
      const merged = state.page === 1 ? list : acc.concat(list);
      paintListings._acc = merged;
      grid.innerHTML = merged.map(renderListing).join('');
      shown = merged.length;
      grid.hidden = merged.length === 0;
    } else {
      shown = Math.min(list.length, PAGE_SIZE * state.page);
      // Sponsored listings open the results and recur between them (the rule
      // lives in rentleaks-x.js, shared with the app). Placing the whole list
      // before slicing keeps "Show more" consistent with the first page.
      const ordered = window.RLSponsored ? window.RLSponsored.order(list, state.city) : list;
      grid.innerHTML = ordered.slice(0, shown).map(renderListing).join('');
      grid.hidden = list.length === 0;
    }
    renderPager(shown, total);
    renderBrowseMap(usingLive ? (paintListings._acc || list) : list);
    renderRoomsShowcase();

    if (empty) {
      empty.hidden = total > 0;
      empty.innerHTML = '<h3>Nothing matches — yet</h3>' +
        '<p>Try a longer stay window, a wider all-in budget, or drop a must-have. Rooms and lease-breaks move fast, so alerts beat refreshing.</p>' +
        '<button type="button" class="btn btn--outline" data-chip="__all">Clear all filters</button> ' +
        '<a class="btn btn--primary" href="' + assetBase() + 'match.html">Run Stay DNA</a>';
    }
    const suggest = $('#rl-suggest');
    if (suggest) {
      const alts = total ? filterListings({ city: state.city, type: '', priceMax: state.priceMax }).slice(0, 3) : [];
      if (alts.length && state.type) {
        suggest.hidden = false;
        suggest.innerHTML = '<div class="section-head"><div class="section-head__text"><span class="section-head__eyebrow">Widen the net</span>' +
          '<h2>Also worth a look</h2><p>Same city, different stay type — the right home is not always the label you started with.</p></div></div>' +
          '<div class="listings__grid">' + alts.map(renderListing).join('') + '</div>';
      } else {
        suggest.hidden = true;
      }
    }
    setupScrollAnimations();
    injectListingsSchema(usingLive ? (paintListings._acc || list) : list);
  }

  function setupScrollAnimations() {
    const els = $$('.animate-on-scroll');
    if (typeof IntersectionObserver === 'undefined' ||
        (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
      els.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const io = window._rlScrollIo || (window._rlScrollIo = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
        });
      },
      { threshold: 0.04, rootMargin: '0px 0px -32px 0px' }
    ));
    els.forEach((el) => { if (!el.classList.contains('is-visible')) io.observe(el); });
  }
  function populateSearchFields() {
    const citySel = $('#city');
    if (citySel && !(citySel.options && citySel.options.length > 2)) {
      const groups = {};
      (DATA.cities || []).forEach((c) => {
        const g = c.group || c.countryName || 'Other';
        (groups[g] = groups[g] || []).push(c);
      });
      const preferred = ['United States', 'Canada', 'United Kingdom', 'Scotland', 'Ireland', 'France', 'Spain', 'Netherlands', 'Switzerland', 'Germany', 'Italy'];
      // Preference, not a whitelist: any group not listed above still renders,
      // so adding a country to the catalog can never silently drop it.
      const order = preferred.filter((g) => groups[g])
        .concat(Object.keys(groups).filter((g) => preferred.indexOf(g) === -1).sort());
      citySel.innerHTML = '<option value="">All cities</option>' + order.filter((g) => groups[g]).map((g) =>
        '<optgroup label="' + g + '">' + groups[g].map((c) =>
          '<option value="' + c.id + '">' + c.name + ', ' + c.state + (c.launch ? ' · launch' : '') + '</option>'
        ).join('') + '</optgroup>'
      ).join('');
    }
    const typeSel = $('#housing-type');
    if (typeSel) {
      typeSel.innerHTML = '<option value="">All stay types</option>' + (DATA.housingTypes || []).map((t) =>
        '<option value="' + t.id + '">' + t.label + '</option>'
      ).join('');
    }
    const loc = $('#location');
    if (loc && !loc.getAttribute('list')) {
      loc.setAttribute('list', 'rl-places');
      if (!$('#rl-places')) {
        const dl = document.createElement('datalist');
        dl.id = 'rl-places';
        const opts = [];
        (DATA.cities || []).forEach((c) => {
          opts.push(c.name);
          (c.neighborhoods || []).forEach((n) => opts.push(n + ', ' + c.name));
        });
        dl.innerHTML = opts.map((o) => '<option value="' + escapeHtml(o) + '">').join('');
        document.body.appendChild(dl);
      }
    }
  }

  function syncStateFromForm() {
    state.page = 1;
    state.location = $('#location')?.value?.trim() || '';
    state.city = $('#city')?.value || state.city;
    state.type = $('#housing-type')?.value || state.type;
    state.priceMin = $('#price-min')?.value || null;
    state.priceMax = $('#price-max')?.value || null;
    state.beds = $('#beds')?.value || null;
    state.minStay = $('#min-stay')?.value || null;
    state.moveIn = $('#move-in')?.value || '';
    state.sort = $('#sort')?.value || state.sort;
    state.furnished = $('#filter-furnished')?.checked ? 'fully' : '';
    state.pets = $('#filter-pets')?.checked ? 'yes' : '';
    state.privateBath = !!$('#filter-bath')?.checked;
    state.workspace = !!$('#filter-work')?.checked;
    state.noFee = !!$('#filter-nofee')?.checked;
    state.utilitiesIn = !!$('#filter-utils')?.checked;
    state.verified = !!$('#filter-verified')?.checked;
  }

  function applyUrlToState() {
    const p = params();
    state.type = p.get('type') || p.get('category') || document.body.dataset.type || '';
    state.city = p.get('city') || document.body.dataset.city || '';
    state.location = p.get('location') || p.get('q') || '';
    state.priceMin = p.get('min');
    state.priceMax = p.get('max');
    state.beds = p.get('beds');
    state.minStay = p.get('stay');
    state.moveIn = p.get('moveIn') || '';
    state.sort = p.get('sort') || 'newest';
    if (p.get('view') === 'list' || p.get('view') === 'map' || p.get('view') === 'grid') state.view = p.get('view');
    if (location.hash === '#map') state.view = 'map';
    if (p.get('pets') === '1') state.pets = 'yes';
    if (p.get('bath') === '1') state.privateBath = true;
    if (p.get('work') === '1') state.workspace = true;
    if ($('#location') && state.location) $('#location').value = state.location;
    if ($('#city') && state.city) $('#city').value = state.city;
    if ($('#housing-type') && state.type) $('#housing-type').value = state.type;
    if ($('#price-min') && state.priceMin) $('#price-min').value = state.priceMin;
    if ($('#price-max') && state.priceMax) $('#price-max').value = state.priceMax;
    if ($('#beds') && state.beds) $('#beds').value = state.beds;
    if ($('#min-stay') && state.minStay) $('#min-stay').value = state.minStay;
    if ($('#move-in') && state.moveIn) $('#move-in').value = state.moveIn;
    if ($('#sort')) $('#sort').value = state.sort;
  }

  function pushBrowseUrl() {
    if (pageName() !== 'browse' && pageName() !== 'rent') return;
    const p = new URLSearchParams();
    if (state.type) p.set('type', state.type);
    if (state.city) p.set('city', state.city);
    if (state.location) p.set('q', state.location);
    if (state.priceMax) p.set('max', state.priceMax);
    if (state.minStay) p.set('stay', state.minStay);
    if (state.moveIn) p.set('moveIn', state.moveIn);
    const qs = p.toString();
    history.replaceState({}, '', (qs ? 'rent.html?' + qs : 'rent.html') + window.location.hash);
  }

  function toggleSave(id) {
    const ids = savedIds();
    const next = ids.includes(id) ? ids.filter((x) => x !== id) : ids.concat(id);
    write(STORE.saved, next);
    toast(next.includes(id) ? 'Saved to your shortlist' : 'Removed from saved');
    injectChrome();
    bindChromeEvents();
  }

  function toggleCompare(id) {
    let ids = compareIds();
    if (ids.includes(id)) ids = ids.filter((x) => x !== id);
    else {
      if (ids.length >= 3) { toast('Compare up to 3 homes'); return; }
      ids = ids.concat(id);
    }
    write(STORE.compare, ids);
    renderCompareTray();
    $$('[data-compare]').forEach((btn) => {
      const on = ids.includes(btn.dataset.compare);
      btn.classList.toggle('is-on', on);
      btn.textContent = on ? 'Added' : 'Compare';
    });
  }

  function renderCompareTray() {
    const tray = $('#rl-compare-tray');
    if (!tray) return;
    const ids = compareIds();
    if (!ids.length) { tray.hidden = true; tray.innerHTML = ''; return; }
    const items = ids.map(listingById).filter(Boolean);
    tray.hidden = false;
    tray.innerHTML = '<div class="rl-compare-tray__inner"><strong>Compare</strong>' +
      items.map((l) => '<span>' + escapeHtml(typeMeta(l.housingType).short) + ' · ' + money(allIn(l), l) + '</span>').join('') +
      '<a class="btn btn--primary btn--sm" href="compare.html">Open</a>' +
      '<button type="button" class="btn btn--outline btn--sm" id="rl-compare-clear">Clear</button></div>';
    const clear = $('#rl-compare-clear');
    if (clear) clear.onclick = () => { write(STORE.compare, []); renderCompareTray(); };
  }



  /* ---------------------------------------------------------------------
   * Hero carousel — featured photos and video tours
   * -------------------------------------------------------------------
   * Slides are drawn from featured listings across different cities so the
   * hero shows real inventory rather than stock decoration. Media is loaded
   * lazily (only the active slide and its neighbour), video plays only while
   * its slide is active and on screen, and autoplay yields to
   * prefers-reduced-motion, hover, focus and hidden tabs.
   * ------------------------------------------------------------------- */
  const HERO_SLIDE_MS = 6000;

  function heroSlidePicks(limit) {
    const featured = (DATA.listings || []).filter((l) => l.featured && l.image);
    const pool = featured.length ? featured : (DATA.listings || []);
    const seenCity = {};
    const seenType = {};
    const picks = [];
    // One per city first, spreading housing types, so the reel feels curated.
    pool.forEach((l) => {
      if (picks.length >= limit) return;
      if (seenCity[l.cityId]) return;
      if ((seenType[l.housingType] || 0) >= 2) return;
      seenCity[l.cityId] = 1;
      seenType[l.housingType] = (seenType[l.housingType] || 0) + 1;
      picks.push(l);
    });
    for (let i = 0; picks.length < limit && i < pool.length; i += 1) {
      if (picks.indexOf(pool[i]) === -1) picks.push(pool[i]);
    }
    return picks.slice(0, limit);
  }

  function renderHeroCarousel() {
    const host = $('#rl-hero-carousel');
    if (!host) return;
    const slides = heroSlidePicks(6);
    if (!slides.length) { host.hidden = true; return; }

    host.innerHTML = `
      <div class="rl-hero-car" role="group" aria-roledescription="carousel" aria-label="Featured homes">
        <div class="rl-hero-car__stage">
          ${slides.map((l, i) => {
            const isVideo = i % 3 === 1 && l.video && l.video.src;
            const t = typeMeta(l.housingType);
            const media = isVideo
              ? `<video class="rl-hero-car__media" muted playsinline loop preload="none"
                        poster="${escapeHtml(l.video.poster || l.image)}"
                        data-src="${escapeHtml(l.video.src)}"
                        aria-label="${escapeHtml(l.title)} video tour"></video>
                 <span class="rl-hero-car__kind">Video tour</span>`
              : `<img class="rl-hero-car__media" alt="${escapeHtml(l.imageAlt || l.title)}"
                      ${i === 0 ? 'src="' + escapeHtml(l.image) + '" fetchpriority="high"' : 'data-src="' + escapeHtml(l.image) + '" loading="lazy"'}
                      decoding="async" width="1400" height="1750">`;
            return `
              <figure class="rl-hero-car__slide${i === 0 ? ' is-active' : ''}" data-slide="${i}" ${i === 0 ? '' : 'aria-hidden="true"'}>
                ${media}
                <span class="rl-hero-car__shade" aria-hidden="true"></span>
                <figcaption class="rl-hero-car__cap">
                  <span class="rl-hero-car__badge">${escapeHtml(t.short)} · ${escapeHtml(l.cityName)}</span>
                  <a class="rl-hero-car__title" href="${listingHref(l)}" tabindex="${i === 0 ? '0' : '-1'}">${escapeHtml(l.title)}</a>
                  <span class="rl-hero-car__price">${money(allIn(l), l)}<em>all-in /mo</em></span>
                </figcaption>
              </figure>`;
          }).join('')}
        </div>

        <button type="button" class="rl-hero-car__nav rl-hero-car__nav--prev" aria-label="Previous home">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <button type="button" class="rl-hero-car__nav rl-hero-car__nav--next" aria-label="Next home">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>

        <div class="rl-hero-car__dots" role="tablist" aria-label="Choose a featured home">
          ${slides.map((l, i) => `<button type="button" class="rl-hero-car__dot${i === 0 ? ' is-on' : ''}" role="tab"
              aria-selected="${i === 0}" data-goto="${i}" aria-label="${escapeHtml(l.cityName)} — ${escapeHtml(l.title)}"><i></i></button>`).join('')}
        </div>
        <p class="sr-only" aria-live="polite" id="rl-hero-car-status"></p>
      </div>`;

    startHeroCarousel(host, slides);
  }

  function startHeroCarousel(host, slides) {
    const stage = host.querySelector('.rl-hero-car__stage');
    const figures = $$('.rl-hero-car__slide', host);
    const dots = $$('.rl-hero-car__dot', host);
    const status = host.querySelector('#rl-hero-car-status');
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let index = 0;
    let timer = null;
    let paused = false;
    let visible = true;

    function loadMediaFor(i) {
      [i, (i + 1) % figures.length].forEach((n) => {
        const el = figures[n] && figures[n].querySelector('[data-src]');
        if (el && !el.getAttribute('src')) {
          el.setAttribute('src', el.dataset.src);
          el.removeAttribute('data-src');
        }
      });
    }

    function show(next) {
      index = (next + figures.length) % figures.length;
      loadMediaFor(index);
      figures.forEach((f, i) => {
        const on = i === index;
        f.classList.toggle('is-active', on);
        if (on) f.removeAttribute('aria-hidden'); else f.setAttribute('aria-hidden', 'true');
        const link = f.querySelector('.rl-hero-car__title');
        if (link) link.tabIndex = on ? 0 : -1;
        const vid = f.querySelector('video');
        if (vid) {
          if (on && !reduced && visible) { const pr = vid.play(); if (pr && pr.catch) pr.catch(() => {}); }
          else { try { vid.pause(); } catch (e) { /* ignore */ } }
        }
      });
      dots.forEach((d, i) => {
        d.classList.toggle('is-on', i === index);
        d.setAttribute('aria-selected', String(i === index));
      });
      const l = slides[index];
      if (status && l) status.textContent = l.title + ', ' + l.cityName + ' — slide ' + (index + 1) + ' of ' + figures.length;
    }

    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function play() {
      stop();
      if (reduced || paused || !visible || figures.length < 2) return;
      timer = setInterval(() => show(index + 1), HERO_SLIDE_MS);
    }

    host.querySelector('.rl-hero-car__nav--prev').onclick = () => { show(index - 1); play(); };
    host.querySelector('.rl-hero-car__nav--next').onclick = () => { show(index + 1); play(); };
    dots.forEach((d) => { d.onclick = () => { show(Number(d.dataset.goto)); play(); }; });

    host.addEventListener('mouseenter', () => { paused = true; stop(); });
    host.addEventListener('mouseleave', () => { paused = false; play(); });
    host.addEventListener('focusin', () => { paused = true; stop(); });
    host.addEventListener('focusout', () => {
      if (!host.contains(document.activeElement)) { paused = false; play(); }
    });
    host.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(index - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); show(index + 1); }
    });

    // Swipe on touch devices.
    let x0 = null;
    stage.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    stage.addEventListener('touchend', (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) show(index + (dx < 0 ? 1 : -1));
      x0 = null;
    }, { passive: true });

    document.addEventListener('visibilitychange', () => {
      visible = !document.hidden;
      if (visible) play(); else stop();
    });

    if (typeof IntersectionObserver !== 'undefined') {
      new IntersectionObserver((entries) => {
        entries.forEach((en) => { visible = en.isIntersecting; if (visible) play(); else stop(); });
      }, { threshold: 0.25 }).observe(host);
    }

    show(0);
    play();
  }


  /** Popular entry points — fills the hero column and gives crawlers real links. */
  function renderHeroQuick() {
    const host = $('#rl-hero-quick');
    if (!host) return;
    const listings = DATA.listings || [];
    const count = (fn) => listings.filter(fn).length;
    const picks = [
      { label: 'Rooms in New York', href: 'rent.html?type=room&city=nyc', n: count((l) => l.housingType === 'room' && l.cityId === 'nyc') },
      { label: 'Co-living in Berlin', href: 'rent.html?type=coliving&city=berlin', n: count((l) => l.housingType === 'coliving' && l.cityId === 'berlin') },
      { label: 'Lease-breaks in Toronto', href: 'rent.html?type=lease-break&city=toronto', n: count((l) => l.housingType === 'lease-break' && l.cityId === 'toronto') },
      { label: 'Furnished in London', href: 'rent.html?type=furnished&city=london', n: count((l) => l.housingType === 'furnished' && l.cityId === 'london') },
      { label: '1-month+ in Paris', href: 'rent.html?type=short-term&city=paris', n: count((l) => l.housingType === 'short-term' && l.cityId === 'paris') }
    ].filter((p) => p.n > 0);

    host.innerHTML = '<span class="hero__quick-label">Popular right now</span>' +
      '<div class="hero__quick-row">' +
      picks.map((p) => '<a class="hero__quick-chip" href="' + p.href + '">' + escapeHtml(p.label) +
        '<b>' + p.n + '</b></a>').join('') +
      '</div>';
  }


  /* ---------------------------------------------------------------------
   * Operator boutiques
   * ------------------------------------------------------------------- */
  const OPERATOR_KIND_LABEL = { coliving: 'Co-living operator', portfolio: 'Furnished operator', hotel: 'Aparthotel operator', landlord: 'Independent landlord' };

  function operatorHref(o) {
    if (!o) return assetBase() + 'operators.html';
    return assetBase() + 'operators/' + (o.slug || String(o.id || '').replace(/^op-/, '')) + '.html';
  }

  function operatorInitials(name) {
    // Skip connectives and punctuation so "Harbor & Hall" is HH, not H&.
    const skip = { and: 1, the: 1, of: 1, group: 1, co: 1 };
    const words = String(name || '?').split(/[\s.]+/)
      .filter((w) => /^[a-z0-9]/i.test(w) && !skip[w.toLowerCase()]);
    return (words.slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?');
  }

  function operatorOf(listing) {
    if (!listing || !listing.operatorId || !DATA.getOperator) return null;
    return DATA.getOperator(listing.operatorId);
  }


  /* ---------------------------------------------------------------------
   * Reusable listing browser
   * -------------------------------------------------------------------
   * One search / filter / sort / grid-list surface, mounted anywhere a set
   * of homes is shown — an operator's boutique, a city page, a stay type.
   * The scope fixes what it can ever show ({operatorId} | {cityId} | {type});
   * the controls only ever narrow within that scope, and only offer facets
   * that actually exist in it.
   *
   * Progressive enhancement: the host already contains server-rendered cards
   * for crawlers and no-JS visitors. Mounting replaces them.
   * ------------------------------------------------------------------- */
  function scopedListings(scope) {
    let rows = (DATA.listings || []).filter((l) => l.type !== 'sale');
    if (scope.operatorId) rows = rows.filter((l) => l.operatorId === scope.operatorId);
    if (scope.cityId) rows = rows.filter((l) => l.cityId === scope.cityId);
    if (scope.type) rows = rows.filter((l) => l.housingType === scope.type);
    return rows;
  }

  function mountListingBrowser(host, scope, opts) {
    if (!host) return;
    const options = opts || {};
    const all = scopedListings(scope);
    if (!all.length) return;

    const st = { q: '', city: '', type: '', max: null, sort: 'price-asc', view: 'grid', page: 1, must: '' };
    const PER = options.pageSize || 12;

    // Only offer facets that exist inside this scope.
    const cityIds = [];
    const typeIds = [];
    all.forEach((l) => {
      if (cityIds.indexOf(l.cityId) === -1) cityIds.push(l.cityId);
      if (typeIds.indexOf(l.housingType) === -1) typeIds.push(l.housingType);
    });
    const showCity = !scope.cityId && cityIds.length > 1;
    const showType = !scope.type && typeIds.length > 1;

    host.innerHTML = `
      <div class="rl-browser" data-browser>
        <form class="search-card rl-browser__search" role="search" onsubmit="return false">
          <div class="search-form__row">
            <div class="search-field">
              <input type="search" data-b="q" placeholder="Search this portfolio" aria-label="Search this portfolio" title="Search within ${escapeHtml(options.label || 'these homes')}" autocomplete="off">
            </div>
            ${showCity ? `<div class="search-field"><select data-b="city" aria-label="City">
              <option value="">All cities</option>
              ${cityIds.map((id) => { const c = cityMeta(id); return c ? '<option value="' + c.id + '">' + escapeHtml(c.name) + '</option>' : ''; }).join('')}
            </select></div>` : ''}
            ${showType ? `<div class="search-field"><select data-b="type" aria-label="Stay type">
              <option value="">All stay types</option>
              ${typeIds.map((t) => '<option value="' + t + '">' + escapeHtml(typeMeta(t).label) + '</option>').join('')}
            </select></div>` : ''}
            <div class="search-field"><input type="number" data-b="max" min="0" placeholder="Any" aria-label="All-in max"></div>
          </div>
        </form>

        <div class="rl-chips">
          <button type="button" class="rl-chip" data-b-must="furnished">Furnished</button>
          <button type="button" class="rl-chip" data-b-must="privateBath">Private bath</button>
          <button type="button" class="rl-chip" data-b-must="workspace">Workspace</button>
          <button type="button" class="rl-chip" data-b-must="noFee">No fee</button>
          <button type="button" class="rl-chip" data-b-must="pets">Pets ok</button>
        </div>

        <div class="listings__top">
          <h2 class="listings__count" data-b-count></h2>
          <div class="rl-view" role="group" aria-label="View">
            <button type="button" data-b-view="grid" class="is-on">Grid</button>
            <button type="button" data-b-view="list">List</button>
          </div>
          <div class="listings__sort">
            <label>Sort</label>
            <select data-b="sort">
              <option value="price-asc">All-in: low to high</option>
              <option value="price-desc">All-in: high to low</option>
              <option value="move-in">Soonest move-in</option>
              <option value="newest">Newest</option>
            </select>
          </div>
        </div>

        <div class="listings__grid" data-b-results></div>
        <div class="listings__empty" data-b-empty hidden></div>
        <div class="rl-pager" data-b-pager hidden></div>
      </div>`;

    const $b = (sel) => host.querySelector(sel);
    const results = $b('[data-b-results]');
    const countEl = $b('[data-b-count]');
    const empty = $b('[data-b-empty]');
    const pager = $b('[data-b-pager]');

    function match() {
      let rows = all.slice();
      const q = st.q.trim().toLowerCase();
      if (q) {
        rows = rows.filter((l) =>
          (l.title || '').toLowerCase().includes(q) ||
          (l.neighborhood || '').toLowerCase().includes(q) ||
          (l.cityName || '').toLowerCase().includes(q) ||
          (l.location || '').toLowerCase().includes(q));
      }
      if (st.city) rows = rows.filter((l) => l.cityId === st.city);
      if (st.type) rows = rows.filter((l) => l.housingType === st.type);
      if (st.max) rows = rows.filter((l) => allInDisplay(l) <= Number(st.max));
      if (st.must === 'furnished') rows = rows.filter((l) => l.furnishedLevel === 'fully');
      if (st.must === 'privateBath') rows = rows.filter((l) => l.privateBath);
      if (st.must === 'workspace') rows = rows.filter((l) => l.workplaceReady);
      if (st.must === 'noFee') rows = rows.filter((l) => l.noFee);
      if (st.must === 'pets') rows = rows.filter((l) => l.pets && l.pets !== 'none');

      if (st.sort === 'price-asc') rows.sort((a, b) => allInDisplay(a) - allInDisplay(b));
      else if (st.sort === 'price-desc') rows.sort((a, b) => allInDisplay(b) - allInDisplay(a));
      else if (st.sort === 'move-in') rows.sort((a, b) => String(a.availableFrom).localeCompare(String(b.availableFrom)));
      else rows.sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));
      return rows;
    }

    function paint() {
      const rows = match();
      const shown = Math.min(rows.length, PER * st.page);
      countEl.textContent = rows.length.toLocaleString() + ' of ' + all.length +
        ' ' + (all.length === 1 ? 'home' : 'homes');
      results.className = 'listings__grid' + (st.view === 'list' ? ' is-list' : '');
      results.innerHTML = rows.slice(0, shown).map(renderListing).join('');
      results.hidden = rows.length === 0;
      empty.hidden = rows.length > 0;
      if (!rows.length) {
        empty.innerHTML = '<h3>Nothing here matches</h3><p>Widen the budget or drop a must-have to see the rest of this portfolio.</p><button type="button" class="btn btn--outline" data-b-clear>Clear filters</button>';
      }
      if (rows.length > shown) {
        pager.hidden = false;
        pager.innerHTML = '<p class="rl-pager__count">Showing <strong>' + shown + '</strong> of <strong>' + rows.length + '</strong></p>' +
          '<button type="button" class="btn btn--outline" data-b-more>Show ' + Math.min(PER, rows.length - shown) + ' more</button>';
      } else {
        pager.hidden = true;
      }
      host.querySelectorAll('[data-b-must]').forEach((b) => b.classList.toggle('is-on', b.dataset.bMust === st.must));
      host.querySelectorAll('[data-b-view]').forEach((b) => b.classList.toggle('is-on', b.dataset.bView === st.view));
      setupScrollAnimations();
    }

    let t;
    host.addEventListener('input', (e) => {
      const k = e.target.dataset.b;
      if (!k) return;
      clearTimeout(t);
      t = setTimeout(() => {
        st[k] = e.target.value;
        if (k === 'max') st.max = e.target.value ? Number(e.target.value) : null;
        st.page = 1;
        paint();
      }, 180);
    });
    host.addEventListener('change', (e) => {
      const k = e.target.dataset.b;
      if (!k || k === 'q' || k === 'max') return;
      st[k] = e.target.value;
      st.page = 1;
      paint();
    });
    host.addEventListener('click', (e) => {
      const m = e.target.closest('[data-b-must]');
      if (m) { st.must = st.must === m.dataset.bMust ? '' : m.dataset.bMust; st.page = 1; paint(); return; }
      const v = e.target.closest('[data-b-view]');
      if (v) { st.view = v.dataset.bView; paint(); return; }
      if (e.target.closest('[data-b-more]')) { st.page += 1; paint(); return; }
      if (e.target.closest('[data-b-clear]')) {
        st.q = ''; st.city = ''; st.type = ''; st.max = null; st.must = ''; st.page = 1;
        host.querySelectorAll('[data-b]').forEach((el) => { if (el.tagName !== 'SELECT' || el.dataset.b !== 'sort') el.value = ''; });
        paint();
      }
    });
    document.addEventListener('rl:currency', paint);

    decorateSearchFields();
    paint();
  }

  /** Mount browsers onto any pre-rendered page that declares a scope. */
  function mountScopedBrowsers() {
    $$('[data-browse-scope]').forEach((host) => {
      const kind = host.dataset.browseScope;
      const value = host.dataset.browseValue || '';
      if (kind === 'operator') {
        const op = DATA.getOperator ? DATA.getOperator(value) : null;
        if (op) mountListingBrowser(host, { operatorId: op.id }, { label: op.name, pageSize: 12 });
      } else if (kind === 'city') {
        mountListingBrowser(host, { cityId: value }, { label: (cityMeta(value) || {}).name, pageSize: 12 });
      } else if (kind === 'type') {
        mountListingBrowser(host, { type: value }, { label: typeMeta(value).label, pageSize: 12 });
      }
    });
  }

  /* --- Operator directory: search, filter, sort, grid/list ------------- */
  const opState = { q: '', kind: '', country: '', verified: false, minHomes: 0, sort: 'homes', view: 'grid' };

  function operatorCities(o) {
    return o.cityIds.map((id) => (cityMeta(id) || {}).name).filter(Boolean);
  }

  function filterOperators() {
    let rows = (DATA.operators || []).slice();
    const q = opState.q.trim().toLowerCase();
    if (q) {
      rows = rows.filter((o) =>
        o.name.toLowerCase().includes(q) ||
        (o.tagline || '').toLowerCase().includes(q) ||
        operatorCities(o).some((c) => c.toLowerCase().includes(q)) ||
        o.countries.some((c) => c.toLowerCase().includes(q)));
    }
    if (opState.kind) rows = rows.filter((o) => o.kind === opState.kind);
    if (opState.country) rows = rows.filter((o) => o.countries.indexOf(opState.country) !== -1);
    if (opState.verified) rows = rows.filter((o) => o.verified);
    if (opState.minHomes) rows = rows.filter((o) => o.count >= opState.minHomes);

    if (opState.sort === 'name') rows.sort((a, b) => a.name.localeCompare(b.name));
    else if (opState.sort === 'cities') rows.sort((a, b) => b.cityIds.length - a.cityIds.length);
    else if (opState.sort === 'price') rows.sort((a, b) => a.fromAllInUsd - b.fromAllInUsd);
    else if (opState.sort === 'reply') rows.sort((a, b) => a.responseHours - b.responseHours);
    else rows.sort((a, b) => b.count - a.count);
    return rows;
  }

  function operatorCardHtml(o) {
    const cities = operatorCities(o);
    return `
      <a class="rl-op-card animate-on-scroll" href="${operatorHref(o)}">
        <span class="rl-op-card__mark" aria-hidden="true">${escapeHtml(operatorInitials(o.name))}</span>
        <span class="rl-op-card__body">
          <strong>${escapeHtml(o.name)}</strong>
          <em>${escapeHtml(o.tagline)}</em>
          <span class="rl-op-card__meta">${o.count} ${o.count === 1 ? 'home' : 'homes'} · ${cities.length} ${cities.length === 1 ? 'city' : 'cities'}${o.verified ? ' · Verified' : ''}</span>
        </span>
      </a>`;
  }

  function operatorRowHtml(o) {
    const cities = operatorCities(o);
    return `
      <a class="rl-op-row animate-on-scroll" href="${operatorHref(o)}">
        <span class="rl-op-card__mark" aria-hidden="true">${escapeHtml(operatorInitials(o.name))}</span>
        <span class="rl-op-row__main">
          <strong>${escapeHtml(o.name)}</strong>
          <em>${escapeHtml(o.tagline)}</em>
        </span>
        <span class="rl-op-row__col"><b>${escapeHtml(OPERATOR_KIND_LABEL[o.kind] || 'Operator')}</b><i>${o.since ? 'since ' + o.since : ''}</i></span>
        <span class="rl-op-row__col"><b>${o.count}</b><i>${o.count === 1 ? 'home' : 'homes'}</i></span>
        <span class="rl-op-row__col"><b>${cities.length}</b><i>${cities.length === 1 ? 'city' : 'cities'}</i></span>
        <span class="rl-op-row__col"><b>${money(o.fromAllIn, o.currency)}</b><i>from</i></span>
        <span class="rl-op-row__col"><b>~${o.responseHours}h</b><i>reply</i></span>
        <span class="rl-op-row__go" aria-hidden="true">→</span>
      </a>`;
  }

  function paintOperators() {
    const host = $('#rl-op-results');
    const countEl = $('#rl-op-count');
    const empty = $('#rl-op-empty');
    if (!host) return;
    const rows = filterOperators();

    if (countEl) {
      countEl.textContent = rows.length.toLocaleString() + ' ' +
        (rows.length === 1 ? 'operator' : 'operators') +
        (opState.kind ? ' · ' + (OPERATOR_KIND_LABEL[opState.kind] || '') : '');
    }
    host.className = opState.view === 'list' ? 'rl-op-list' : 'rl-op-grid';
    host.innerHTML = opState.view === 'list'
      ? rows.map(operatorRowHtml).join('')
      : rows.map(operatorCardHtml).join('');
    host.hidden = rows.length === 0;
    if (empty) {
      empty.hidden = rows.length > 0;
      empty.innerHTML = '<h3>No operators match</h3><p>Try a different market, or clear the filters to see all ' +
        (DATA.operators || []).length + '.</p><button type="button" class="btn btn--outline js-op-clear">Clear filters</button>';
    }
    $$('[data-op-kind]').forEach((b) => b.classList.toggle('is-on', b.dataset.opKind === opState.kind));
    $$('[data-op-view]').forEach((b) => b.classList.toggle('is-on', b.dataset.opView === opState.view));
    const vf = $('#op-verified');
    if (vf) vf.checked = opState.verified;
    setupScrollAnimations();
  }

  function renderOperatorsDirectory() {
    const shell = $('#rl-operators');
    if (!shell) return;
    const ops = DATA.operators || [];
    const countries = [];
    ops.forEach((o) => o.countries.forEach((c) => { if (countries.indexOf(c) === -1) countries.push(c); }));
    countries.sort();

    shell.innerHTML = `
      <form class="search-card rl-op-search" role="search" onsubmit="return false">
        <div class="search-form__row">
          <div class="search-field">
            <input type="search" id="op-q" placeholder="Search operators, brands or cities" aria-label="Search operators" autocomplete="off">
          </div>
          <div class="search-field">
            <select id="op-country" aria-label="Country">
              <option value="">All countries</option>
              ${countries.map((c) => '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + '</option>').join('')}
            </select>
          </div>
          <div class="search-field">
            <select id="op-size" aria-label="Portfolio size">
              <option value="0">Any size</option>
              <option value="2">2+ homes</option>
              <option value="10">10+ homes</option>
              <option value="25">25+ homes</option>
            </select>
          </div>
        </div>
      </form>

      <div class="rl-chips" id="rl-op-kinds">
        <button type="button" class="rl-chip is-on" data-op-kind="">All operators</button>
        <button type="button" class="rl-chip" data-op-kind="coliving">Co-living</button>
        <button type="button" class="rl-chip" data-op-kind="portfolio">Furnished portfolios</button>
        <button type="button" class="rl-chip" data-op-kind="hotel">Hotel groups</button>
        <button type="button" class="rl-chip" data-op-kind="landlord">Independent landlords</button>
        <label class="rl-check rl-check--inline"><input type="checkbox" id="op-verified"> Verified only</label>
      </div>

      <div class="listings__top">
        <h2 class="listings__count" id="rl-op-count">${ops.length} operators</h2>
        <div class="rl-view" role="group" aria-label="View">
          <button type="button" data-op-view="grid" class="is-on">Grid</button>
          <button type="button" data-op-view="list">List</button>
        </div>
        <div class="listings__sort">
          <label for="op-sort">Sort</label>
          <select id="op-sort">
            <option value="homes">Most homes</option>
            <option value="cities">Most markets</option>
            <option value="price">Lowest from-price</option>
            <option value="reply">Fastest reply</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>
      </div>

      <div id="rl-op-results" class="rl-op-grid"></div>
      <div id="rl-op-empty" class="listings__empty" hidden></div>`;

    const on = (sel, ev, fn) => { const el = $(sel); if (el) el.addEventListener(ev, fn); };
    let t;
    on('#op-q', 'input', (e) => { clearTimeout(t); t = setTimeout(() => { opState.q = e.target.value; paintOperators(); }, 180); });
    on('#op-country', 'change', (e) => { opState.country = e.target.value; paintOperators(); });
    on('#op-size', 'change', (e) => { opState.minHomes = Number(e.target.value) || 0; paintOperators(); });
    on('#op-sort', 'change', (e) => { opState.sort = e.target.value; paintOperators(); });
    on('#op-verified', 'change', (e) => { opState.verified = e.target.checked; paintOperators(); });

    shell.addEventListener('click', (e) => {
      const k = e.target.closest('[data-op-kind]');
      if (k) { opState.kind = k.dataset.opKind; paintOperators(); }
      const v = e.target.closest('[data-op-view]');
      if (v) { opState.view = v.dataset.opView; paintOperators(); }
      if (e.target.closest('.js-op-clear')) {
        opState.q = ''; opState.kind = ''; opState.country = ''; opState.verified = false; opState.minHomes = 0;
        const q = $('#op-q'); if (q) q.value = '';
        const c = $('#op-country'); if (c) c.value = '';
        const z = $('#op-size'); if (z) z.value = '0';
        paintOperators();
      }
    });

    decorateSearchFields();
    paintOperators();
  }

  function renderOperatorPage() {
    const root = $('#rl-operator');
    if (!root) return;
    const slug = document.body.dataset.operator ||
      (location.pathname.match(/\/operators\/([^/]+)\.html/) || [])[1] ||
      params().get('op') || '';
    const o = DATA.getOperator ? DATA.getOperator(decodeURIComponent(slug)) : null;

    if (!o) {
      root.innerHTML = '<div class="container rl-empty"><h1>Operator not found</h1><p>This boutique may have been removed.</p><a class="btn btn--primary" href="' + assetBase() + 'operators.html">All operators</a></div>';
      return;
    }

    const homes = (DATA.listings || []).filter((l) => l.operatorId === o.id);
    const cities = o.cityIds.map((id) => (cityMeta(id) || {}).name).filter(Boolean);
    const typeChips = o.types.map((t) => '<a class="rl-chip" href="' + assetBase() + 'rent.html?type=' + t + '">' + escapeHtml(typeMeta(t).label) + '</a>').join('');

    root.innerHTML = `
      <div class="container">
        <nav class="rl-crumb" aria-label="Breadcrumb"><a href="${assetBase()}index.html">Home</a> / <a href="${assetBase()}operators.html">Operators</a> / ${escapeHtml(o.name)}</nav>

        <header class="rl-op-hero">
          <span class="rl-op-hero__mark" aria-hidden="true">${escapeHtml(operatorInitials(o.name))}</span>
          <div class="rl-op-hero__text">
            <span class="rl-kicker">${escapeHtml(OPERATOR_KIND_LABEL[o.kind] || 'Operator')}${o.since ? ' · since ' + o.since : ''}</span>
            <h1>${escapeHtml(o.name)}</h1>
            <p class="rl-lead">${escapeHtml(o.tagline)}</p>
            <div class="rl-badges">
              ${o.verified ? '<span class="rl-badge rl-badge--safe">All homes verified</span>' : ''}
              ${o.noFeeAll ? '<span class="rl-badge">No broker fee</span>' : ''}
              <span class="rl-badge">Replies in ~${o.responseHours}h</span>
            </div>
          </div>
        </header>

        <div class="rl-pulse">
          <article class="rl-stat"><span>Homes listed</span><strong>${o.count}</strong><em>across this portfolio</em></article>
          <article class="rl-stat"><span>Markets</span><strong>${o.cityIds.length}</strong><em>${escapeHtml(cities.slice(0, 3).join(', '))}${cities.length > 3 ? ' +' + (cities.length - 3) : ''}</em></article>
          <article class="rl-stat"><span>From</span><strong>${money(o.fromAllIn, o.currency)}</strong><em>all-in${o.multiCurrency ? ' · cheapest of ' + o.countries.length + ' countries' : ' per month'}</em></article>
          <article class="rl-stat"><span>Typical reply</span><strong>${o.responseHours}h</strong><em>to a first message</em></article>
        </div>

        ${typeChips ? '<div class="rl-chips rl-block">' + typeChips + '</div>' : ''}

        <section class="rl-block">
          <div class="section-head"><div class="section-head__text">
            <span class="section-head__eyebrow">Portfolio</span>
            <h2>${o.count} ${o.count === 1 ? 'home' : 'homes'} from ${escapeHtml(o.name)}</h2>
          </div></div>
          <div data-browse-scope="operator" data-browse-value="${escapeHtml(o.slug)}"></div>
        </section>
      </div>`;
    mountScopedBrowsers();
    setupScrollAnimations();
  }

  function renderHome() {
    const listings = DATA.listings || [];
    const cities = DATA.cities || [];
    const rc = $('#trust-rent-count');
    const cc = $('#trust-city-count');
    if (rc) rc.textContent = listings.length.toLocaleString();
    if (cc) cc.textContent = String(cities.length);

    const types = $('#rl-types');
    if (types) {
      types.innerHTML = (DATA.housingTypes || []).map((t) => {
        const n = listings.filter((l) => l.housingType === t.id).length;
        return `<a class="rl-type-card" href="${t.href}"><span class="rl-type-card__kicker">${n} live</span><h3>${t.label}</h3><p>${t.blurb}</p><span class="rl-type-card__cta">Browse ${t.short}</span></a>`;
      }).join('');
    }

    const cityHost = $('#rl-cities');
    if (cityHost) {
      const featured = cities.filter((c) => c.featured);
      const homeCities = featured.filter((c) => (c.country || 'US') === 'US').slice(0, 8)
        .concat(featured.filter((c) => (c.country || 'US') !== 'US'));
      cityHost.innerHTML = homeCities.map((c) => {
        const n = listings.filter((l) => l.cityId === c.id).length;
        const badge = (c.country || 'US') === 'US' ? '#' + c.rank : c.group;
        return `<a class="rl-city-card" href="${cityHref(c)}"><span class="rl-city-card__rank">${badge}</span><h3>${c.name}</h3><p>${c.state} · ${n} flexible homes</p><span>Walk ${c.walk} · Transit ${c.transit}</span></a>`;
      }).join('');
    }

    const rooms = listings.filter((l) => l.housingType === 'room');
    const breaks = listings.filter((l) => l.housingType === 'lease-break');
    // Average across markets only makes sense once converted.
    const avgRoom = Math.round(rooms.reduce((s, l) => s + allInDisplay(l), 0) / Math.max(1, rooms.length));
    const avgBreak = Math.round(breaks.reduce((s, l) => s + (l.remainingMonths || 0), 0) / Math.max(1, breaks.length));
    const noFee = listings.filter((l) => l.noFee).length;
    const noFeePct = Math.round((noFee / Math.max(1, listings.length)) * 100);

    const pulse = $('#rl-pulse');
    if (pulse) {
      pulse.innerHTML = `
        <article class="rl-stat"><span>Live inventory <b id="rl-live-badge" class="rl-live-tag">Cached</b></span><strong>${listings.length.toLocaleString()}</strong><em>across ${cities.length} markets</em></article>
        <article class="rl-stat"><span>Typical room all-in</span><strong>${money(avgRoom)}</strong><em>fees already counted</em></article>
        <article class="rl-stat"><span>Lease Clock</span><strong>${avgBreak} mo</strong><em>average time left on takeovers</em></article>
        <article class="rl-stat"><span>No broker fee</span><strong>${noFeePct}%</strong><em>of every home we list</em></article>`;
    }

    const proof = $('#rl-proof');
    if (proof) {
      const nyc = cities.find((c) => c.id === 'nyc') || cities[0] || {};
      const nycRooms = listings.filter((l) => l.cityId === nyc.id && l.housingType === 'room');
      const cheapest = nycRooms.slice().sort((a, b) => allIn(a) - allIn(b))[0];
      const bench = nyc.avgRoom || 0;
      const pct = cheapest && bench ? Math.max(6, Math.min(100, Math.round((allIn(cheapest) / bench) * 100))) : 60;
      proof.innerHTML = `
        <div class="hero-proof__head">
          <span class="hero-proof__title">Market pulse</span>
          <span class="hero-proof__live"><span class="hero-proof__dot"></span><span id="rl-live-badge">Cached</span></span>
        </div>
        <div class="hero-proof__row"><span class="hero-proof__k">Homes listed right now</span><span class="hero-proof__v">${listings.length.toLocaleString()}</span></div>
        <div class="hero-proof__row"><span class="hero-proof__k">Markets covered</span><span class="hero-proof__v">${cities.length}</span></div>
        <div class="hero-proof__row"><span class="hero-proof__k">Listings with zero broker fee</span><span class="hero-proof__v">${noFeePct}%</span></div>
        <div class="hero-proof__row"><span class="hero-proof__k">Lease takeovers listed</span><span class="hero-proof__v">${breaks.length}</span></div>
        <div style="padding-top:.5rem">
          <p class="hero-proof__note">Cheapest ${escapeHtml(nyc.name || 'New York')} room vs. the ${escapeHtml(nyc.name || 'local')} median</p>
          <div class="hero-proof__bar"><span class="hero-proof__fill" style="width:${pct}%"></span></div>
          <p class="hero-proof__note" style="margin-top:.35rem">${cheapest ? money(allIn(cheapest), cheapest) + ' all-in vs ' + money(bench) + ' typical' : 'All-in pricing on every card'}</p>
        </div>`;
    }

    renderHeroCarousel();
    renderHeroQuick();

    const grid = $('#listings-grid');
    if (grid) {
      const featured = listings.filter((l) => l.featured).slice(0, 6);
      const fallback = filterListings({ type: '', city: 'nyc' }).slice(0, 6);
      grid.innerHTML = (featured.length ? featured : fallback).map(renderListing).join('');
    }
  }
  function renderCitiesPage() {
    const grid = $('#rl-city-directory');
    if (!grid) return;
    const groups = {};
    (DATA.cities || []).forEach((c) => {
      const g = c.group || c.countryName || 'Other';
      (groups[g] = groups[g] || []).push(c);
    });
    const preferred = ['United States', 'Canada', 'United Kingdom', 'Scotland', 'Ireland', 'France', 'Spain', 'Netherlands', 'Switzerland', 'Germany', 'Italy'];
      // Preference, not a whitelist: any group not listed above still renders,
      // so adding a country to the catalog can never silently drop it.
      const order = preferred.filter((g) => groups[g])
        .concat(Object.keys(groups).filter((g) => preferred.indexOf(g) === -1).sort());
    grid.innerHTML = order.filter((g) => groups[g]).map((g) => {
      const rows = groups[g].map((c) => {
        const n = (DATA.listings || []).filter((l) => l.cityId === c.id).length;
        const avg = Math.round((DATA.listings || []).filter((l) => l.cityId === c.id).reduce((s, l) => s + allIn(l), 0) / Math.max(1, n));
        const badge = (c.country || 'US') === 'US' ? (c.rank <= 30 ? '#' + c.rank : 'Launch') : c.country;
        return `<a class="rl-city-row" href="${cityHref(c)}">
          <span class="rl-city-row__rank">${badge}</span>
          <span><strong>${c.name}</strong><em>${c.state}${c.launch ? ' · original RentLeaks market' : ''}</em></span>
          <span>${n} homes</span>
          <span>${money(avg, c)} avg all-in</span>
          <span>Walk ${c.walk}</span>
        </a>`;
      }).join('');
      return `<section class="rl-city-group"><h2 class="rl-city-group__title">${g}</h2>${rows}</section>`;
    }).join('');
  }

  function renderCityPage() {
    const id = params().get('city') || 'nyc';
    const city = cityMeta(id);
    if (!city) return;
    state.city = city.id;
    const title = $('#rl-city-title');
    const sub = $('#rl-city-sub');
    const nhoods = $('#rl-nhoods');
    const pulse = $('#rl-city-pulse');
    if (title) title.textContent = city.name + ' flexible housing';
    document.title = city.name + ' rooms, co-living, furnished & lease-breaks | RentLeaks';
    if (sub) sub.textContent = 'Rooms, co-living, furnished apartments, 1-month+ stays, and lease-breaks in ' + city.name + ', ' + city.state + '.';
    if (nhoods) {
      nhoods.innerHTML = (city.neighborhoods || []).map((n) =>
        '<a class="category-chip" href="' + assetBase() + 'rent.html?city=' + city.id + '&q=' + encodeURIComponent(n) + '">' + escapeHtml(n) + '</a>'
      ).join('');
    }
    if (pulse) {
      const list = (DATA.listings || []).filter((l) => l.cityId === city.id);
      const byType = (DATA.housingTypes || []).map((t) => {
        const subset = list.filter((l) => l.housingType === t.id);
        const avg = Math.round(subset.reduce((s, l) => s + allIn(l), 0) / Math.max(1, subset.length));
        return `<a class="rl-stat" href="${typeHref(t.id)}?city=${city.id}"><span>${t.label}</span><strong>${subset.length}</strong><em>${subset.length ? money(avg, c) + ' all-in' : 'coming online'}</em></a>`;
      }).join('');
      pulse.innerHTML = byType;
    }
    if ($('#city')) $('#city').value = city.id;
    renderListings();
  }

  function renderDetail() {
    const id = params().get('id') || document.body.dataset.listingId;
    const l = listingById(id);
    const root = $('#rl-detail');
    if (!root) return;
    if (!l) {
      root.innerHTML = '<div class="container rl-empty"><h1>Listing unavailable</h1><p>It may have been taken. Browse live inventory instead.</p><a class="btn btn--primary" href="' + assetBase() + 'rent.html">Back to search</a></div>';
      return;
    }
    const recent = read(STORE.recent, []).filter((x) => x !== l.id).slice(0, 8);
    recent.unshift(l.id);
    write(STORE.recent, recent);
    const t = typeMeta(l.housingType);
    document.title = l.title + ' · ' + l.cityName + ' | RentLeaks';
    const pref = read(STORE.match, null);
    const match = pref ? scoreListing(l, pref) : null;
    const fees = l.fees || {};
    const extras = (fees.utilities || 0) + (fees.wifi || 0) + (fees.cleaning || 0);
    const takeoverSave = l.housingType === 'lease-break'
      ? Math.max(0, Math.round((cityMeta(l.cityId)?.avgFurnished || l.price * 1.3) - l.price) * (l.remainingMonths || 1))
      : 0;
    const furniture = (l.furniture || []).map((f) => '<li>' + escapeHtml(f) + '</li>').join('') || '<li>Unfurnished — bring your own</li>';
    const mates = (l.housemates || []).map((m) =>
      '<article class="rl-mate"><strong>' + escapeHtml(m.name) + '</strong><span>' + escapeHtml(m.ageRange) + ' · ' + escapeHtml(m.occupation) + '</span><em>' + escapeHtml(m.vibe) + '</em></article>'
    ).join('');
    const amens = (l.amenities || []).map((a) => '<span class="amenity-chip">' + escapeHtml(a.replace(/-/g, ' ')) + '</span>').join('');
    const scores = l.neighborhoodScores || {};
    const saved = savedIds().includes(l.id);

    root.innerHTML = `
      <div class="container rl-detail">
        <nav class="rl-crumb" aria-label="Breadcrumb"><a href="${assetBase()}rent.html">Search</a> / <a href="${l.cityPath ? assetBase() + l.cityPath : cityHref({ id: l.cityId, name: l.cityName, slug: (cityMeta(l.cityId) || {}).slug })}">${escapeHtml(l.cityName)}</a> / <a href="${typeHref(l.housingType)}">${escapeHtml(t.label)}</a></nav>
        ${renderGalleryMosaic(l)}
        <div class="rl-detail__grid">
          <div>
            <div class="rl-kicker">${escapeHtml(t.label)} · ${escapeHtml(l.neighborhood)}</div>
            <h1>${escapeHtml(l.title)}</h1>
            <p class="listing-card__address">${escapeHtml(l.address)}</p>
            <div class="rl-badges">
              ${l.verified ? '<span class="rl-badge">Verified host</span>' : ''}
              ${l.noFee ? '<span class="rl-badge">No broker fee</span>' : ''}
              ${l.scamShield ? '<span class="rl-badge rl-badge--safe">Scam Shield</span>' : ''}
              ${match != null ? '<span class="rl-badge rl-badge--fit">' + match + '% Stay DNA</span>' : ''}
            </div>
            <p class="rl-lead">${escapeHtml(l.description)}</p>
            ${renderVideoTour(l)}
            <section class="rl-block">
              <h2>Stay terms</h2>
              <dl class="rl-dl">
                <div><dt>Available</dt><dd>${formatDate(l.availableFrom)}</dd></div>
                <div><dt>Minimum stay</dt><dd>${l.minStayMonths} month${l.minStayMonths === 1 ? '' : 's'}</dd></div>
                <div><dt>Maximum stay</dt><dd>${l.maxStayMonths} months</dd></div>
                ${l.leaseEnd ? '<div><dt>Lease ends</dt><dd>' + formatDate(l.leaseEnd) + ' · ' + l.remainingMonths + ' months left</dd></div>' : ''}
                ${l.takeoverType ? '<div><dt>Takeover type</dt><dd>' + l.takeoverType + '</dd></div>' : ''}
                <div><dt>Furnished</dt><dd>${l.furnishedLevel}</dd></div>
                <div><dt>Pets</dt><dd>${l.pets === 'none' ? 'Not allowed' : l.pets}</dd></div>
              </dl>
            </section>
            ${l.housingType === 'lease-break' ? `<section class="rl-block rl-callout"><h2>Takeover math</h2><p>Remaining term × this rent vs. a typical furnished ${escapeHtml(l.cityName)} home. Estimated avoid-cost: <strong>${money(takeoverSave, l)}</strong> over ${l.remainingMonths} months. Confirm assignment vs sublet with the host before you send money.</p></section>` : ''}
            <section class="rl-block">
              <h2>Furniture inventory</h2>
              <ul class="rl-list">${furniture}</ul>
            </section>
            ${mates ? '<section class="rl-block"><h2>Who you would live with</h2><div class="rl-mates">' + mates + '</div></section>' : ''}
            ${l.building ? `<section class="rl-block"><h2>Building</h2><p><strong>${escapeHtml(l.building.name)}</strong> · ${l.building.roomsAvailable} rooms open · ${escapeHtml(l.building.cleaning)} cleaning${l.building.events ? ' · resident events' : ''}${l.building.coworking ? ' · coworking' : ''}.</p></section>` : ''}
            <section class="rl-block">
              <h2>Neighborhood pulse</h2>
              <p>${escapeHtml(l.commuteNote)}</p>
              <div class="rl-scores">
                <span>Walk ${scores.walk || '—'}</span><span>Transit ${scores.transit || '—'}</span>
                <span>Grocery ${scores.grocery || '—'}</span><span>Quiet ${scores.quiet || '—'}</span>
              </div>
            </section>
            <section class="rl-block"><h2>Amenities</h2><div class="amenity-chips">${amens}</div></section>
            <section class="rl-block rl-shield">
              <h2>Scam Shield</h2>
              <ul>
                <li>Never wire a deposit before a live video tour or in-person walkthrough.</li>
                <li>RentLeaks does not ask you to pay off-platform “application unlock” fees.</li>
                <li>Lease-breaks must show remaining term and assignment vs sublet.</li>
                <li>Report this listing from the apply step if anything feels off.</li>
              </ul>
            </section>
          </div>
          <aside class="rl-side">
            <div class="rl-price-card">
              <p class="listing-card__price">${money(allIn(l), l)}<span class="listing-card__period">all-in /mo</span>${leakChip(l)}</p>
              <ul class="rl-fee-stack">
                <li><span>Base rent</span><strong>${money(l.price, l)}</strong></li>
                <li><span>Utilities</span><strong>${fees.utilities ? money(fees.utilities, l) : 'Included'}</strong></li>
                <li><span>Wifi</span><strong>${fees.wifi ? money(fees.wifi, l) : 'Included'}</strong></li>
                <li><span>Cleaning</span><strong>${fees.cleaning ? money(fees.cleaning, l) : extras && l.housingType !== 'coliving' ? '—' : 'Included'}</strong></li>
                <li><span>Broker fee</span><strong>${fees.broker ? money(fees.broker, l) + ' one-time' : 'None'}</strong></li>
                <li><span>Deposit</span><strong>${money(l.deposit, l)}</strong></li>
              </ul>
              ${(function () {
                const op = operatorOf(l);
                if (!op) return '<p class="rl-host">Listed by ' + escapeHtml(l.host.name) + ' · replies in ~' + l.host.responseHours + 'h · current tenant</p>';
                return '<a class="rl-host rl-host--link" href="' + operatorHref(op) + '">' +
                  '<span class="rl-host__mark" aria-hidden="true">' + escapeHtml(operatorInitials(op.name)) + '</span>' +
                  '<span class="rl-host__text"><strong>' + escapeHtml(op.name) + '</strong>' +
                  '<span>' + op.count + ' ' + (op.count === 1 ? 'home' : 'homes') + ' · replies in ~' + op.responseHours + 'h</span></span>' +
                  '<span class="rl-host__go" aria-hidden="true">→</span></a>';
              })()}
              <a class="btn btn--primary btn--lg" href="${assetBase()}apply.html?id=${encodeURIComponent(l.id)}">Apply with passport</a>
              <div class="rl-price-card__actions">
                <button type="button" class="btn btn--outline" data-save="${escapeHtml(l.id)}">${saved ? 'Saved' : 'Save'}</button>
                <button type="button" class="btn btn--outline" data-compare="${escapeHtml(l.id)}">Compare</button>
              </div>
              <a class="btn btn--ghost btn--sm" href="${assetBase()}contact.html?listing=${encodeURIComponent(l.id)}">Message host</a>
            </div>
          </aside>
        </div>
        <section class="rl-block">
          <h2>Similar stays</h2>
          <div class="listings__grid" id="rl-similar"></div>
        </section>
      </div>`;
    const similar = filterListings({ type: l.housingType, city: l.cityId }).filter((x) => x.id !== l.id).slice(0, 3);
    const sim = $('#rl-similar');
    if (sim) sim.innerHTML = similar.map(renderListing).join('');
  }

  function renderMatch() {
    const root = $('#rl-match');
    if (!root) return;
    const existing = read(STORE.match, null);
    root.innerHTML = `
      <form class="rl-quiz" id="rl-quiz">
        <div class="form-group"><label>Where first?</label>
          <select name="city" class="form-input" required>
            <option value="">Choose a city</option>
            ${(DATA.cities || []).map((c) => '<option value="' + c.id + '"' + (existing && existing.city === c.id ? ' selected' : '') + '>' + c.name + '</option>').join('')}
          </select>
        </div>
        <fieldset class="rl-fieldset"><legend>Stay types you will consider</legend>
          ${(DATA.housingTypes || []).map((t) => '<label class="rl-check"><input type="checkbox" name="types" value="' + t.id + '"' + (existing && (existing.types || []).includes(t.id) ? ' checked' : '') + '> ' + t.label + '</label>').join('')}
        </fieldset>
        <div class="form-group"><label>All-in monthly ceiling</label>
          <input type="number" name="budget" class="form-input" min="400" step="50" value="${existing?.budget || 2500}" required>
        </div>
        <div class="form-group"><label>Longest you can commit (months)</label>
          <select name="stay" class="form-input">
            <option value="1">1–3 months</option>
            <option value="3">Up to 3</option>
            <option value="6">Up to 6</option>
            <option value="12" ${(existing && existing.stay === '12') ? 'selected' : ''}>Up to 12</option>
          </select>
        </div>
        <div class="form-group"><label>House energy</label>
          <select name="vibe" class="form-input">
            ${['quiet-professional', 'social', 'creative', 'mixed'].map((v) => '<option value="' + v + '"' + (existing && existing.vibe === v ? ' selected' : '') + '>' + v.replace('-', ' ') + '</option>').join('')}
          </select>
        </div>
        <label class="rl-check"><input type="checkbox" name="workspace" ${existing?.workspace ? 'checked' : ''}> I need a real desk / work setup</label>
        <label class="rl-check"><input type="checkbox" name="pets" ${existing?.pets === 'yes' ? 'checked' : ''}> I have a pet</label>
        <label class="rl-check"><input type="checkbox" name="privateBath" ${existing?.privateBath ? 'checked' : ''}> Private bathroom is a must</label>
        <button type="submit" class="btn btn--primary">Build my Stay DNA</button>
      </form>
      <div id="rl-match-results"></div>`;
    $('#rl-quiz').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const pref = {
        city: fd.get('city'),
        types: fd.getAll('types'),
        budget: fd.get('budget'),
        stay: fd.get('stay'),
        vibe: fd.get('vibe'),
        workspace: fd.get('workspace') === 'on',
        pets: fd.get('pets') === 'on' ? 'yes' : 'no',
        privateBath: fd.get('privateBath') === 'on'
      };
      if (!pref.types.length) pref.types = (DATA.housingTypes || []).map((t) => t.id);
      write(STORE.match, pref);
      const ranked = filterListings({ city: pref.city, type: '' })
        .map((l) => ({ l, s: scoreListing(l, pref) }))
        .sort((a, b) => b.s - a.s)
        .slice(0, 9);
      const box = $('#rl-match-results');
      box.innerHTML = '<h2>Your ranked homes</h2><p>Stay DNA is a local fit score — budget, stay length, vibe, and must-haves. Not a credit decision.</p><div class="listings__grid">' + ranked.map((x) => renderListing(x.l)).join('') + '</div>';
      toast('Stay DNA saved — listings will show a fit score');
    });
  }

  function renderSaved() {
    const root = $('#rl-saved');
    if (!root) return;
    const saved = savedIds().map(listingById).filter(Boolean);
    const alerts = read(STORE.alerts, []);
    const recent = read(STORE.recent, []).map(listingById).filter(Boolean).slice(0, 6);
    root.innerHTML = `
      <section class="rl-block"><h2>Shortlist</h2>
        ${saved.length ? '<div class="listings__grid">' + saved.map(renderListing).join('') + '</div>' : '<p>Nothing saved yet. Heart a room or lease-break to build a shortlist.</p>'}
      </section>
      <section class="rl-block"><h2>Alerts</h2>
        <form id="rl-alert-form" class="form profile-form">
          <div class="form__row">
            <div class="form-group"><label>City</label><select name="city" class="form-input">${(DATA.cities || []).map((c) => '<option value="' + c.id + '">' + c.name + '</option>').join('')}</select></div>
            <div class="form-group"><label>Type</label><select name="type" class="form-input">${(DATA.housingTypes || []).map((t) => '<option value="' + t.id + '">' + t.label + '</option>').join('')}</select></div>
          </div>
          <div class="form-group"><label>All-in max</label><input type="number" name="max" class="form-input" value="2500"></div>
          <button class="btn btn--primary" type="submit">Save alert</button>
        </form>
        <ul class="rl-list" id="rl-alert-list">${alerts.map((a, i) => '<li>' + escapeHtml(a.type) + ' in ' + escapeHtml(a.city) + ' ≤ ' + money(a.max) + ' <button type="button" data-del-alert="' + i + '">Remove</button></li>').join('')}</ul>
      </section>
      <section class="rl-block"><h2>Recently viewed</h2>
        <div class="listings__grid">${recent.map(renderListing).join('')}</div>
      </section>`;
    $('#rl-alert-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const next = alerts.concat([{ city: fd.get('city'), type: fd.get('type'), max: Number(fd.get('max')) }]);
      write(STORE.alerts, next);
      toast('Alert on. We will flag matching new homes in this browser.');
      renderSaved();
    });
  }

  function renderApply() {
    const root = $('#rl-apply');
    if (!root) return;
    const l = listingById(params().get('id'));
    const p = profile() || {};
    root.innerHTML = `
      <div class="rl-apply">
        ${l ? '<aside class="rl-price-card"><p class="rl-kicker">Applying to</p><h2>' + escapeHtml(l.title) + '</h2><p>' + money(allIn(l), l) + ' all-in · ' + escapeHtml(l.location) + '</p></aside>' : ''}
        <form class="form form-card" id="rl-passport">
          <h2>Renter passport</h2>
          <p>Reuse this on every apply. Hosts see stay length and move window — not a mystery email.</p>
          <div class="form-group"><label>Full name</label><input name="name" class="form-input" required value="${escapeHtml(p.name || '')}"></div>
          <div class="form-group"><label>Email</label><input type="email" name="email" class="form-input" required value="${escapeHtml(p.email || '')}"></div>
          <div class="form-group"><label>Move-in window</label><input type="date" name="moveIn" class="form-input" value="${escapeHtml(p.moveIn || '')}"></div>
          <div class="form-group"><label>Intended stay (months)</label><input type="number" name="stay" class="form-input" min="1" max="18" value="${escapeHtml(p.stay || 3)}"></div>
          <div class="form-group"><label>Income range</label>
            <select name="income" class="form-input">
              <option>Under $50k</option><option> $50–75k</option><option>$75–120k</option><option>$120k+</option>
            </select>
          </div>
          <div class="form-group"><label>Why this stay</label><textarea name="note" class="form-input" rows="4" placeholder="Relocation, contract, lease-break, housemate fit…">${escapeHtml(p.note || '')}</textarea></div>
          <label class="rl-check"><input type="checkbox" name="tour" checked> I will not pay a deposit before a live tour</label>
          <button class="btn btn--primary" type="submit">${l ? 'Send application' : 'Save passport'}</button>
        </form>
      </div>`;
    $('#rl-passport').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const next = { name: fd.get('name'), email: fd.get('email'), moveIn: fd.get('moveIn'), stay: fd.get('stay'), income: fd.get('income'), note: fd.get('note') };
      write(STORE.profile, next);
      write(STORE.session, { name: next.name, email: next.email });
      toast(l ? 'Application sent to the host. Passport saved.' : 'Passport saved.');
      injectChrome();
      bindChromeEvents();
    });
  }

  function renderListWizard() {
    const root = $('#rl-list');
    if (!root) return;
    const kind = params().get('kind') || 'room';
    root.innerHTML = `
      <form class="form form-card rl-wizard" id="rl-wizard">
        <p class="rl-kicker">List in minutes</p>
        <h2>What are you listing?</h2>
        <div class="rl-kind-grid">
          ${(DATA.housingTypes || []).map((t) => '<label class="rl-kind' + (kind === t.id ? ' is-on' : '') + '"><input type="radio" name="housingType" value="' + t.id + '"' + (kind === t.id ? ' checked' : '') + '><strong>' + t.label + '</strong><span>' + t.promise + '</span></label>').join('')}
        </div>
        <div class="form-group"><label>City</label>
          <select name="cityId" class="form-input" required>${(DATA.cities || []).map((c) => '<option value="' + c.id + '"' + (c.id === 'nyc' ? ' selected' : '') + '>' + c.name + '</option>').join('')}</select>
        </div>
        <div class="form-group"><label>Neighborhood</label><input name="neighborhood" class="form-input" required placeholder="Williamsburg, Brickell, Mission…"></div>
        <div class="form-group"><label>Title</label><input name="title" class="form-input" required placeholder="Private room + bath near the G"></div>
        <div class="form__row">
          <div class="form-group"><label>Monthly rent</label><input type="number" name="price" class="form-input" required min="400" value="1400"></div>
          <div class="form-group"><label>Utilities /mo</label><input type="number" name="utilities" class="form-input" value="0"></div>
        </div>
        <div class="form__row">
          <div class="form-group"><label>Available</label><input type="date" name="availableFrom" class="form-input" required></div>
          <div class="form-group"><label>Min stay (months)</label><input type="number" name="minStayMonths" class="form-input" min="1" value="1"></div>
        </div>
        <div class="form-group" id="rl-lease-fields" hidden>
          <label>Lease end date</label><input type="date" name="leaseEnd" class="form-input">
          <label>Takeover type</label>
          <select name="takeoverType" class="form-input"><option value="assignment">Assignment</option><option value="sublet">Sublet</option></select>
        </div>
        <div class="form-group"><label>Description</label><textarea name="description" class="form-input" rows="4" required placeholder="Who lives here, what is included, what is not."></textarea></div>
        <p class="rl-allin-live">All-in preview: <strong id="rl-allin-preview">$1,400</strong> /mo</p>
        <p class="pricing-note">Your first week is free, on every listing. After that, one price for every type — rooms, co-living, furnished and lease-breaks alike. Renters are never charged.</p>
        <button class="btn btn--primary" type="submit">Publish listing</button>
      </form>`;
    const form = $('#rl-wizard');
    const syncAllIn = () => {
      const price = Number(form.price.value || 0);
      const util = Number(form.utilities.value || 0);
      $('#rl-allin-preview').textContent = money(price + util);
      const type = form.housingType.value;
      $('#rl-lease-fields').hidden = type !== 'lease-break';
      $$('.rl-kind').forEach((el) => el.classList.toggle('is-on', el.querySelector('input').checked));
      // Aparthotels exist here only because of the 30-day floor: hold it.
      const kindNow = (form.querySelector('input[name="housingType"]:checked') || {}).value;
      const minStayEl = form.querySelector('[name="minStayMonths"]');
      if (minStayEl) {
        const locked = kindNow === 'aparthotel';
        minStayEl.min = '1';
        if (locked && Number(minStayEl.value || 0) < 1) minStayEl.value = '1';
        minStayEl.setAttribute('aria-describedby', locked ? 'rl-minstay-note' : '');
        let note = form.querySelector('#rl-minstay-note');
        if (locked && !note) {
          note = document.createElement('p');
          note.id = 'rl-minstay-note';
          note.className = 'pricing-note';
          note.textContent = 'Aparthotel listings are monthly only — RentLeaks does not take nightly bookings.';
          minStayEl.parentNode.appendChild(note);
        } else if (!locked && note) {
          note.remove();
        }
      }
    };
    form.addEventListener('input', syncAllIn);
    form.addEventListener('change', syncAllIn);
    syncAllIn();
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const city = cityMeta(fd.get('cityId'));
      const type = fd.get('housingType');
      const price = Number(fd.get('price'));
      const utilities = Number(fd.get('utilities') || 0);
      const id = 'mine-' + Date.now();
      const listing = {
        id, type: 'rent', housingType: type,
        title: fd.get('title'),
        address: fd.get('neighborhood') + ', ' + city.name + ', ' + city.state,
        neighborhood: fd.get('neighborhood'),
        cityId: city.id, cityName: city.name, state: city.state,
        price, priceSuffix: '/mo',
        fees: { broker: 0, utilities, wifi: 0, cleaning: 0, parking: 0 },
        allIn: price + utilities, deposit: price, lastMonth: 0,
        beds: 1, baths: 1, sqft: 200,
        specs: type === 'room' || type === 'coliving' ? 'Host-listed room' : 'Host-listed apartment',
        privateBath: true, roommates: type === 'room' ? 1 : 0, housemates: [],
        furnishedLevel: type === 'lease-break' ? 'partial' : 'fully',
        furniture: ['bed + mattress', 'desk + chair'],
        minStayMonths: Number(fd.get('minStayMonths') || 1),
        maxStayMonths: type === 'lease-break' ? 6 : 12,
        availableFrom: fd.get('availableFrom'),
        leaseEnd: fd.get('leaseEnd') || null,
        remainingMonths: type === 'lease-break' ? 4 : null,
        takeoverType: fd.get('takeoverType') || null,
        utilitiesIncluded: utilities === 0 ? ['utilities'] : [],
        amenities: ['workspace'], workplaceReady: true, pets: 'none',
        verified: false, noFee: true, scamShield: true,
        images: [IMAGES_SAFE()], image: IMAGES_SAFE(),
        location: city.name + ' · ' + fd.get('neighborhood'),
        categories: [type],
        description: fd.get('description'),
        neighborhoodScores: { walk: city.walk, transit: city.transit, grocery: 70, nightlife: 60, quiet: 55 },
        commuteNote: 'Host-listed. Confirm transit on your tour.',
        postedAt: '2026-09-07', featured: true,
        building: null,
        host: { name: (session() && session().name) || 'You', type: type === 'lease-break' ? 'current-tenant' : 'host', responseHours: 2 },
        vibe: 'mixed'
      };
      const mine = read(STORE.listings, []);
      mine.unshift(listing);
      write(STORE.listings, mine);
      DATA.listings.unshift(listing);
      toast('Live on RentLeaks in this browser');
      window.location.href = listingHref(listing);
    });
  }

  function IMAGES_SAFE() {
    return 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1400&q=80';
  }

  function renderComparePage() {
    const root = $('#rl-compare');
    if (!root) return;
    const items = compareIds().map(listingById).filter(Boolean);
    if (!items.length) {
      root.innerHTML = '<p>Add up to 3 homes from search, then come back.</p><a class="btn btn--primary" href="' + assetBase() + 'rent.html">Browse</a>';
      return;
    }
    const rows = [
      ['Stay type', (l) => typeMeta(l.housingType).label],
      ['All-in /mo', (l) => money(allIn(l), l)],
      ['Base rent', (l) => money(l.price, l)],
      ['City', (l) => l.location],
      ['Available', (l) => formatDate(l.availableFrom)],
      ['Min stay', (l) => l.minStayMonths + ' mo'],
      ['Lease left', (l) => l.remainingMonths ? l.remainingMonths + ' mo' : '—'],
      ['Furnished', (l) => l.furnishedLevel],
      ['Private bath', (l) => l.privateBath ? 'Yes' : 'No'],
      ['Workspace', (l) => l.workplaceReady ? 'Yes' : 'No'],
      ['Pets', (l) => l.pets],
      ['Broker fee', (l) => l.fees && l.fees.broker ? money(l.fees.broker, l) : 'None'],
      ['Verified', (l) => l.verified ? 'Yes' : 'Not yet']
    ];
    root.innerHTML = '<div class="rl-compare-table"><table><thead><tr><th></th>' +
      items.map((l) => '<th><a href="' + listingHref(l) + '">' + escapeHtml(l.title) + '</a></th>').join('') +
      '</tr></thead><tbody>' +
      rows.map((r) => '<tr><th>' + r[0] + '</th>' + items.map((l) => '<td>' + r[1](l) + '</td>').join('') + '</tr>').join('') +
      '</tbody></table></div>';
  }

  function renderProfessionalsCopy() {
    const note = $('#rl-pro-note');
    if (note) {
      note.textContent = 'Built for room hosts, co-living operators, furnished portfolios, and tenants posting a lease-break. Your first week is free, whatever you are listing.';
    }
  }

  function injectListingsSchema(list) {
    if (!list || !list.length) return;
    $$('script[data-rl-schema]').forEach((n) => n.remove());
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Flexible housing on RentLeaks',
      description: 'Rooms, co-living, furnished apartments, 1-month stays, and lease-breaks in major U.S. cities.',
      numberOfItems: list.length,
      itemListElement: list.slice(0, 12).map((l, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'Accommodation',
          name: l.title,
          address: { '@type': 'PostalAddress', streetAddress: l.address, addressLocality: l.cityName, addressRegion: l.state },
          offers: { '@type': 'Offer', price: allIn(l), priceCurrency: 'USD' }
        }
      }))
    };
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.dataset.rlSchema = '1';
    el.textContent = JSON.stringify(schema);
    document.head.appendChild(el);
  }


  function openModal(id) {
    const overlay = $('#modal-' + id);
    if (!overlay) return;
    overlay.classList.add('is-active');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    const focusable = overlay.querySelector('input, button, a');
    if (focusable) focusable.focus();
  }

  function closeModals() {
    $$('.modal-overlay.is-active').forEach((ov) => {
      ov.classList.remove('is-active');
      ov.setAttribute('aria-hidden', 'true');
    });
    document.body.style.overflow = '';
  }
  function openCmd() {
    const cmd = $('#rl-cmd');
    if (!cmd) return;
    cmd.hidden = false;
    cmd.classList.add('is-open');
    const input = $('#rl-cmd-input');
    if (input) { input.value = ''; input.focus(); renderCmd(''); }
  }
  function closeCmd() {
    const cmd = $('#rl-cmd');
    if (cmd) {
      cmd.hidden = true;
      cmd.classList.remove('is-open');
    }
  }

  function renderCmd(q) {
    const box = $('#rl-cmd-results');
    if (!box) return;
    const query = (q || '').trim().toLowerCase();
    const rows = [];
    (DATA.housingTypes || []).forEach((t) => {
      if (!query || t.label.toLowerCase().includes(query)) {
        rows.push({ href: assetBase() + t.href, label: t.label, hint: 'Stay type' });
      }
    });
    (DATA.cities || []).forEach((c) => {
      if (!query || c.name.toLowerCase().includes(query) || String(c.state).toLowerCase().includes(query)) {
        rows.push({ href: cityHref(c), label: c.name + ', ' + c.state, hint: 'Market' });
      }
    });
    if (query) {
      filterListings({ location: q, type: '', city: '' }).slice(0, 6).forEach((l) => {
        rows.push({ href: listingHref(l), label: l.title, hint: money(allIn(l), l) + ' all-in · ' + l.cityName });
      });
    }
    box.innerHTML = rows.slice(0, 12).map((r, i) =>
      '<a href="' + r.href + '"' + (i === 0 ? ' class="is-active"' : '') + '><strong>' + escapeHtml(r.label) + '</strong><span>' + escapeHtml(r.hint) + '</span></a>'
    ).join('') || '<p>Nothing matches “' + escapeHtml(q) + '”. Try a city or “lease-break”.</p>';
    cmdIndex = 0;
  }

  let cmdIndex = 0;
  function moveCmd(dir) {
    const links = $$('#rl-cmd-results a');
    if (!links.length) return;
    cmdIndex = (cmdIndex + dir + links.length) % links.length;
    links.forEach((a, i) => a.classList.toggle('is-active', i === cmdIndex));
    links[cmdIndex].scrollIntoView({ block: 'nearest' });
  }
  function openActiveCmd() {
    const active = $('#rl-cmd-results a.is-active') || $('#rl-cmd-results a');
    if (active) window.location.href = active.getAttribute('href');
  }

  function bindChromeEvents() {
    const navToggle = $('.nav-toggle');
    const nav = $('.nav');
    if (navToggle && nav && !navToggle.dataset.bound) {
      navToggle.dataset.bound = '1';
      navToggle.addEventListener('click', () => {
        const expanded = navToggle.getAttribute('aria-expanded') === 'true';
        navToggle.setAttribute('aria-expanded', String(!expanded));
        nav.classList.toggle('is-open', !expanded);
      });
    }
    $$('.js-modal-trigger').forEach((btn) => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', (e) => { e.preventDefault(); openModal(btn.dataset.modal); });
    });
    $$('.js-modal-close').forEach((btn) => { btn.onclick = closeModals; });
    $$('.js-cmd').forEach((btn) => { btn.onclick = openCmd; });
    $$('.js-theme').forEach((btn) => { btn.onclick = toggleTheme; });
    $$('.js-currency').forEach((sel) => {
      sel.onchange = () => setDisplayCurrency(sel.value);
    });

    const header = $('.header');
    if (header && !window._rlStuck) {
      window._rlStuck = true;
      const onScroll = () => header.classList.toggle('is-stuck', window.scrollY > 8);
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }
  }
  function bindEvents() {
    bindChromeEvents();

    document.addEventListener('click', (e) => {
      if (e.target.classList && e.target.classList.contains('modal-overlay')) closeModals();
      if (e.target.id === 'rl-cmd') closeCmd();
      const save = e.target.closest('[data-save]');
      if (save) {
        e.preventDefault();
        e.stopPropagation();
        toggleSave(save.dataset.save);
        const on = savedIds().includes(save.dataset.save);
        save.classList.toggle('listing-card__save--saved', on);
        const svg = save.querySelector('svg');
        if (svg) svg.setAttribute('fill', on ? 'currentColor' : 'none');
      }
      const cmp = e.target.closest('[data-compare]');
      if (cmp) {
        e.preventDefault();
        e.stopPropagation();
        toggleCompare(cmp.dataset.compare);
      }
      const del = e.target.closest('[data-del-alert]');
      if (del) {
        const alerts = read(STORE.alerts, []);
        alerts.splice(Number(del.dataset.delAlert), 1);
        write(STORE.alerts, alerts);
        renderSaved();
      }
      const gal = e.target.closest('[data-open-gallery]');
      if (gal) {
        e.preventDefault();
        const listing = listingById(gal.dataset.openGallery);
        if (listing) openLightbox(listingMedia(listing), Number(gal.dataset.galleryIndex || 0));
      }
      if (e.target.closest('[data-lb-close]')) closeLightbox();
      const lbStep = e.target.closest('[data-lb-step]');
      if (lbStep) stepLightbox(Number(lbStep.dataset.lbStep));
      const lbGoto = e.target.closest('[data-lb-goto]');
      if (lbGoto) {
        lbState.index = Number(lbGoto.dataset.lbGoto);
        paintLightbox();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeLightbox(); closeModals(); closeCmd(); }
      if ($('#rl-lb') && $('#rl-lb').classList.contains('is-open')) {
        if (e.key === 'ArrowRight') { e.preventDefault(); stepLightbox(1); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); stepLightbox(-1); }
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const cmd = $('#rl-cmd');
        if (cmd && !cmd.hidden) closeCmd(); else openCmd();
      }
    });

    const cmdInput = $('#rl-cmd-input');
    if (cmdInput) cmdInput.addEventListener('input', () => renderCmd(cmdInput.value));

    $$('.modal-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        $$('.modal-tab').forEach((t) => t.classList.remove('is-active'));
        $$('.modal-panel').forEach((p) => p.classList.remove('is-active'));
        tab.classList.add('is-active');
        const panel = $('#panel-' + tab.dataset.panel);
        if (panel) panel.classList.add('is-active');
      });
    });

    $$('.js-auth-form').forEach((form) => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const name = fd.get('name') || String(fd.get('email') || 'Member').split('@')[0];
        write(STORE.session, { name: name, email: fd.get('email') });
        if (form.dataset.action === 'signup') {
          write(STORE.profile, Object.assign(profile() || {}, { name: name, email: fd.get('email') }));
        }
        closeModals();
        toast('Signed in. Your passport lives in this browser.');
        injectChrome();
        bindChromeEvents();
      });
    });

    const form = $('.search-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        syncStateFromForm();
        if (pageName() === 'home') {
          const p = new URLSearchParams();
          if (state.type) p.set('type', state.type);
          if (state.city) p.set('city', state.city);
          if (state.location) p.set('q', state.location);
          if (state.priceMax) p.set('max', state.priceMax);
          if (state.minStay) p.set('stay', state.minStay);
          if (state.moveIn) p.set('moveIn', state.moveIn);
          window.location.href = 'rent.html' + (p.toString() ? '?' + p : '');
          return;
        }
        pushBrowseUrl();
        renderListings();
        $('#listings')?.scrollIntoView({ behavior: 'smooth' });
      });
      ['input', 'change'].forEach((ev) => {
        form.addEventListener(ev, () => {
          if (pageName() === 'home') return;
          syncStateFromForm();
          pushBrowseUrl();
          renderListings();
        });
      });
    }

    $$('.rl-adv input').forEach((el) => {
      el.addEventListener('change', () => {
        syncStateFromForm();
        renderListings();
      });
    });

    const sortEl = $('#sort');
    if (sortEl) sortEl.addEventListener('change', () => { state.sort = sortEl.value; renderListings(); });

    const viewBtns = $$('[data-view]');
    viewBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        state.view = btn.dataset.view;
        viewBtns.forEach((b) => b.classList.toggle('is-on', b === btn));
        renderListings();
      });
    });

    $$('.pricing-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        $$('.pricing-tab').forEach((t) => { t.classList.remove('pricing-tab--active'); t.setAttribute('aria-selected', 'false'); });
        tab.classList.add('pricing-tab--active');
        tab.setAttribute('aria-selected', 'true');
      });
    });

    function handleFormSubmit(formEl, successMsg) {
      if (!formEl) return;
      const btn = formEl.querySelector('button[type="submit"]');
      if (btn && !btn.dataset.originalText) btn.dataset.originalText = btn.textContent;
      formEl.addEventListener('submit', (e) => {
        e.preventDefault();
        if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }
        setTimeout(() => {
          const existing = formEl.querySelector('.form__message--success');
          if (existing) { existing.hidden = false; existing.textContent = successMsg; }
          else {
            const p = document.createElement('p');
            p.className = 'form__message form__message--success';
            p.textContent = successMsg;
            formEl.appendChild(p);
          }
          if (btn) { btn.disabled = false; btn.textContent = btn.dataset.originalText || 'Submit'; }
        }, 500);
      });
    }
    handleFormSubmit($('#contact-form'), 'Thanks — a human will reply within a day.');
    handleFormSubmit($('#profile-form'), 'Alerts are on for this browser.');
    handleFormSubmit($('#sales-form'), 'Received. Operator onboarding will follow up.');
    $$('.newsletter__form').forEach((f) => {
      f.addEventListener('submit', (e) => {
        e.preventDefault();
        const btn = f.querySelector('button[type="submit"]');
        const inp = f.querySelector('input[type="email"]');
        const alerts = read(STORE.alerts, []);
        alerts.push({ city: 'nyc', type: 'room', max: 3000, email: inp && inp.value });
        write(STORE.alerts, alerts);
        if (inp) inp.value = '';
        if (btn) btn.textContent = 'Alerts on';
        toast('Alert saved');
      });
    });

    /* --- fee popover, chips, filter sheet --------------------------- */
    document.addEventListener('click', (e) => {
      const feeBtn = e.target.closest('[data-fees]');
      if (feeBtn) {
        e.preventDefault();
        const already = $('#rl-fee-pop');
        if (already && already.dataset.for === feeBtn.dataset.fees) { closeFeePop(); return; }
        openFeePop(feeBtn, feeBtn.dataset.fees);
        const pop = $('#rl-fee-pop');
        if (pop) pop.dataset.for = feeBtn.dataset.fees;
        return;
      }
      if (!e.target.closest('#rl-fee-pop')) closeFeePop();

      const chip = e.target.closest('[data-chip]');
      if (chip) { e.preventDefault(); clearFilter(chip.dataset.chip); }

      const setType = e.target.closest('[data-set-type]');
      if (setType) { state.type = setType.dataset.setType; state.page = 1; pushBrowseUrl(); renderListings(); return; }
      const setBeds = e.target.closest('[data-set-beds]');
      if (setBeds) { state.beds = setBeds.dataset.setBeds || null; state.page = 1; renderListings(); return; }
      const setStay = e.target.closest('[data-set-stay]');
      if (setStay) { state.minStay = setStay.dataset.setStay || null; state.page = 1; renderListings(); return; }
      const setMax = e.target.closest('[data-set-max]');
      if (setMax) {
        const v = Number(setMax.dataset.setMax);
        state.priceMax = state.priceMax === v ? null : v;
        state.page = 1; renderListings(); return;
      }
      if (e.target.closest('.js-load-more')) {
        state.page += 1;
        renderListings();
        return;
      }
      if (e.target.closest('.js-filter-open')) openFilterSheet();
      if (e.target.closest('.js-filter-done')) closeFilterSheet();
    });
    document.addEventListener('input', (e) => {
      if (e.target.id === 'rail-min' || e.target.id === 'rail-max') {
        clearTimeout(window._rlRailT);
        window._rlRailT = setTimeout(() => {
          state.priceMin = $('#rail-min').value ? Number($('#rail-min').value) : null;
          state.priceMax = $('#rail-max').value ? Number($('#rail-max').value) : null;
          state.page = 1;
          renderListings();
        }, 320);
      }
    });
    window.addEventListener('resize', closeFeePop, { passive: true });
    window.addEventListener('scroll', closeFeePop, { passive: true });

    document.addEventListener('keydown', (e) => {
      const cmd = $('#rl-cmd');
      if (!cmd || cmd.hidden) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); moveCmd(1); }
      if (e.key === 'ArrowUp') { e.preventDefault(); moveCmd(-1); }
      if (e.key === 'Enter') { e.preventDefault(); openActiveCmd(); }
    });
  }

  function init() {
    const page = pageName();
    if (page === 'listing' && params().get('id')) {
      const found = listingById(params().get('id'));
      if (found && found.path && !/\/listings\//.test(location.pathname)) {
        location.replace(found.path);
        return;
      }
    }
    if (page === 'city' && params().get('city')) {
      const found = cityMeta(params().get('city'));
      if (found && found.slug && !/\/cities\//.test(location.pathname)) {
        location.replace('cities/' + found.slug + '.html');
        return;
      }
    }
    applyTheme(currentTheme());
    document.documentElement.classList.add('js-reveal');
    injectChrome();
    populateSearchFields();
    decorateSearchFields();
    applyUrlToState();
    renderMenuHero();
    if (page === 'home') renderHome();
    else if (page === 'browse' || page === 'rent') renderListings();
    else if (page === 'listing') {
      renderDetail();
      hydrateListingMap();
      if (params().get('gallery') === '1') {
        const found = listingById(params().get('id') || document.body.dataset.listingId);
        if (found) openLightbox(listingMedia(found), Number(params().get('shot') || 0));
      }
    }
    else if (page === 'cities') renderCitiesPage();
    else if (page === 'city') {
      const slugMatch = location.pathname.match(/\/cities\/([^/]+)\.html/);
      if (slugMatch && !params().get('city')) {
        const city = cityMeta(decodeURIComponent(slugMatch[1]));
        if (city) state.city = city.id;
      }
      if (!document.body.dataset.static) renderCityPage();
    }
    else if (page === 'match') renderMatch();
    else if (page === 'saved') renderSaved();
    else if (page === 'apply') renderApply();
    else if (page === 'list') renderListWizard();
    else if (page === 'compare') renderComparePage();
    else if (page === 'professionals') renderProfessionalsCopy();
    else if (page === 'operators') renderOperatorsDirectory();
    else if (page === 'operator') renderOperatorPage();
    if ($('#listings-grid') && page !== 'home' && page !== 'listing' && page !== 'saved' && page !== 'match') {
      // city page already rendered
    }
    document.addEventListener('rl:currency', () => {
      const page = pageName();
      if (page === 'home') renderHome();
      else if (page === 'browse' || page === 'rent') { state.page = 1; renderListings(); }
      else if (page === 'listing') renderDetail();
      else if (page === 'city') renderCityPage();
      else if (page === 'compare') renderComparePage();
      else if (page === 'saved') renderSaved();
      setupScrollAnimations();
    });
    document.addEventListener('rl:meta', () => markLiveState(true));
    document.addEventListener('rl:data-offline', () => markLiveState(false));
    markLiveState(false);
    mountScopedBrowsers();
    bindEvents();
    if (params().get('modal') === 'auth') openModal('auth');
    setupScrollAnimations();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
