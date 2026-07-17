/* 테스트용 목(mock) 쇼핑몰 — 실제 쇼핑몰 페이지와 동일한 구조
   1) /product/knit-round  : JSON-LD + 가로형 사이즈표(둘레 표기) + M 품절 옵션
   2) /product/wide-denim  : OG 메타 + 세로(전치)형 사이즈표(단면 표기)
   3) /product/no-chart    : 사이즈표 없는 페이지 (폴백 경로 검증용)
   실행: node test/mock-shop.js  (PORT 기본 8899) */
"use strict";

const http = require("node:http");

const PAGES = {
  "/product/knit-round": `<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8">
<title>소프트 램스울 라운드 니트 - 어반클로젯</title>
<meta property="og:title" content="소프트 램스울 라운드 니트">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Product","name":"소프트 램스울 라운드 니트",
"brand":{"@type":"Brand","name":"URBAN CLOSET"},
"offers":{"@type":"Offer","price":"47500","priceCurrency":"KRW","availability":"https://schema.org/InStock"}}
</script></head>
<body>
<h1>소프트 램스울 라운드 니트</h1>
<div class="price">47,500원</div>
<div class="options">
  <select name="size">
    <option value="">사이즈 선택</option>
    <option value="S">S</option>
    <option value="M" disabled>M (품절)</option>
    <option value="L">L</option>
  </select>
</div>
<div class="detail">
  <p>램스울 혼방 소재로 신축성이 좋은 니트입니다. 울 40% 아크릴 40% 나일론 15% 스판덱스 5%</p>
  <h3>사이즈 실측 (cm)</h3>
  <table>
    <tr><th>사이즈</th><th>어깨너비</th><th>가슴둘레</th><th>소매길이</th><th>총장</th></tr>
    <tr><td>S</td><td>40</td><td>96</td><td>58</td><td>61</td></tr>
    <tr><td>M</td><td>42</td><td>102</td><td>59.5</td><td>63</td></tr>
    <tr><td>L</td><td>44</td><td>108</td><td>61</td><td>65</td></tr>
  </table>
  <p>* 재는 방법과 위치에 따라 1~3cm 오차가 있을 수 있습니다.</p>
</div>
</body></html>`,

  "/product/wide-denim": `<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8">
<title>원턱 와이드 데님 팬츠 | 데일리진</title>
<meta property="og:title" content="원턱 와이드 데님 팬츠">
<meta property="product:price:amount" content="39800">
</head>
<body>
<h1>원턱 와이드 데님 팬츠</h1>
<ul class="size-select">
  <li><button>S</button></li>
  <li><button>M</button></li>
  <li><button class="soldout" disabled>L 품절</button></li>
</ul>
<div class="size-info">
  <h3>SIZE (단면, cm)</h3>
  <table>
    <tr><th>cm</th><td>S</td><td>M</td><td>L</td></tr>
    <tr><th>허리단면</th><td>34</td><td>36.5</td><td>39</td></tr>
    <tr><th>엉덩이단면</th><td>52</td><td>54.5</td><td>57</td></tr>
    <tr><th>허벅지단면</th><td>34</td><td>35.5</td><td>37</td></tr>
    <tr><th>총장</th><td>102</td><td>103</td><td>104</td></tr>
  </table>
  <p>논스판 데님 원단입니다.</p>
</div>
</body></html>`,

  "/product/no-chart": `<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8"><title>감성 오버핏 자켓</title></head>
<body><h1>감성 오버핏 자켓</h1><p>상세 이미지를 참고해주세요.</p>
<img src="/detail.jpg" alt="상세"></body></html>`,
};

const PORT = process.env.MOCK_PORT || 8899;
http.createServer((req, res) => {
  const page = PAGES[new URL(req.url, "http://x").pathname];
  if (!page) { res.writeHead(404); return res.end("not found"); }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(page);
}).listen(PORT, () => console.log(`mock shop → http://localhost:${PORT}`));
