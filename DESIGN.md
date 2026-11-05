---
name: 일손잇다
description: 농장주와 일손의 일정 조율을 돕는 모바일 우선 웹 앱
colors:
  paper: "#f4efe3"
  surface: "#fffdf7"
  sunken: "#ece5d3"
  ink: "#1d2a1f"
  ink-soft: "#4f5b4c"
  line: "#d9cfb8"
  field: "#1f5a34"
  field-deep: "#163f25"
  field-tint: "#e3eedf"
  harvest: "#a24f08"
  harvest-tint: "#f8e4c4"
  berry: "#a3261c"
  berry-tint: "#f9dfd9"
  sky: "#1c5a7d"
  sky-tint: "#dcebf3"
typography:
  body:
    fontFamily: "Pretendard Variable, Pretendard, Malgun Gothic, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.55
  headline:
    fontFamily: "Pretendard Variable, Pretendard, Malgun Gothic, system-ui, sans-serif"
    fontSize: "1.65rem"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Pretendard Variable, Pretendard, Malgun Gothic, system-ui, sans-serif"
    fontSize: "1.15rem"
    fontWeight: 700
    lineHeight: 1.25
  label:
    fontFamily: "Pretendard Variable, Pretendard, Malgun Gothic, system-ui, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 600
rounded:
  sm: "8px"
  md: "10px"
  lg: "12px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "14px"
  lg: "18px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.field}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.field-deep}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "16px 18px"
  input:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
    height: "44px"
---

# Design System: 일손잇다

## Overview

**Creative North Star: "햇살 아래 들판의 작업대"**

일손잇다는 농장주와 일손이 휴대전화로 일정을 확인하고 결정을 내리는 업무 화면이다. 시각 언어는 따뜻한 종이색 바탕과 짙은 농지 초록을 중심으로, 수확 주황을 필요한 주의와 강조에 제한해 사용한다. 장식보다 한눈에 읽히는 정보 구조, 뚜렷한 상호작용, 야외 사용을 고려한 큰 터치 영역을 우선한다.

Pretendard Variable을 기본으로 사용하고, 입력·작업 카드·목록 등 현재 제품의 기능 구조를 그대로 따른다. 반응형 화면에서도 농장주와 일손의 용어 및 기존 흐름은 유지한다.

**Key Characteristics:**
- 종이빛 중립 배경과 깊은 농지 초록
- 모바일 우선, 읽기 쉬운 한글과 넉넉한 터치 영역
- 색은 상태와 행동을 구분하는 데 사용
- 정보 중심의 카드·폼·목록 UI

## Colors

따뜻한 종이색과 자연을 연상시키는 녹색을 기본으로 하고, 주의·오류·정보 상태에는 서로 구분되는 색을 쓴다.

### Primary
- **농지 초록** (`#1f5a34`): 주요 동작 버튼과 강조 요소.
- **깊은 농지 초록** (`#163f25`): 고정 헤더와 주요 내비게이션 배경.

### Secondary
- **수확 주황** (`#a24f08`): 중요한 주의, 안내 강조 및 단계 표시.
- **하늘 파랑** (`#1c5a7d`): 정보성 상태.

### Tertiary
- **오류 베리** (`#a3261c`): 오류 상태와 위험한 동작.

### Neutral
- **들판 종이** (`#f4efe3`): 페이지 배경.
- **표면 크림** (`#fffdf7`): 카드와 기본 컨트롤 표면.
- **가라앉은 종이** (`#ece5d3`): 보조 표면과 기본 칩.
- **잉크** (`#1d2a1f`): 기본 본문 텍스트.
- **부드러운 잉크** (`#4f5b4c`): 보조 텍스트.
- **종이 테두리** (`#d9cfb8`): 카드·채팅 테두리.
- **상태 틴트** (`#e3eedf`, `#f8e4c4`, `#f9dfd9`, `#dcebf3`): 성공·주의·오류·정보 배경에 각각 사용.

## Typography

**Display Font:** Pretendard Variable (with Pretendard, Malgun Gothic, system-ui, sans-serif fallbacks)  
**Body Font:** Pretendard Variable (with Pretendard, Malgun Gothic, system-ui, sans-serif fallbacks)

**Character:** 굵기와 크기 차이로 우선순위를 명확히 하는 친근하고 단정한 한글 산세리프. 고령 사용자와 야외의 작은 화면에서도 빠르게 훑어볼 수 있도록 한다.

### Hierarchy
- **Headline** (800, `1.65rem`, line-height `1.25`): 화면 제목.
- **Title** (700, `1.15rem`, line-height `1.25`): 카드·섹션 제목.
- **Body** (400, `17px`, line-height `1.55`): 본문과 폼 값. 좁은 화면에서는 기본 크기를 `16px`로 낮춘다.
- **Label** (600, `0.9rem`): 입력 라벨과 조작 설명.

## Layout

작업 흐름은 단일 열 중심이며, 넓은 화면에서만 역할 선택 카드처럼 자연스러운 행 배치를 사용한다. 기본 콘텐츠 최대 너비는 `960px`이고, 페이지 좌우 패딩은 데스크톱 `18px`, 화면 폭 `520px` 이하에서는 `14px`이다. 기본 간격은 `8–18px` 범위에서 카드·폼·행에 적용한다. 한글 문장은 단어 단위로 줄바꿈해 읽기 흐름을 보존한다.

## Elevation & Depth

표면색과 얇은 테두리로 기본 위계를 만들고, 카드에는 낮고 부드러운 그림자를 적용한다. 호버 중인 역할 카드만 초록 계열의 확산 그림자로 상호작용을 강조한다. 헤더는 고정되며 본문과 분리되는 얕은 그림자를 가진다.

### Shadow Vocabulary
- **카드** (`0 1px 2px rgba(60, 45, 15, .08), 0 6px 18px -8px rgba(60, 45, 15, .18)`): 일반 카드의 기본 깊이.
- **고정 헤더** (`0 2px 10px rgba(22, 63, 37, .25)`): 스크롤 중 헤더와 콘텐츠를 구분.

## Shapes

버튼과 입력은 `8px`, 일반 카드는 `10px`, 일러스트 표면은 `12px` 둥근 모서리를 쓴다. 상태 배지는 완전히 둥근 캡슐이다. 카드와 입력은 밝은 표면과 얇은 따뜻한 테두리를 기본으로 한다.

## Components

### Buttons
- **Shape:** `8px` 모서리, 최소 높이 `44px`, 패딩 `8px 16px`.
- **Primary:** 농지 초록 배경에 흰 텍스트. 호버 시 깊은 농지 초록으로 바뀐다.
- **Secondary:** 크림 표면, 잉크 텍스트, 따뜻한 테두리.
- **Danger:** 오류 베리 텍스트와 테두리. 호버 시 옅은 베리 배경.
- **Hover / Focus:** 배경·테두리를 부드럽게 전환한다. 키보드 포커스는 `3px` 수확 주황 외곽선으로 드러낸다.

### Chips
- **Style:** 상태별 옅은 틴트 배경, 대응하는 진한 텍스트, 캡슐 모양.
- **State:** 확인·제안·취소·초안 상태는 색상뿐 아니라 맥락에 맞는 텍스트 라벨을 함께 쓴다.

### Cards / Containers
- **Corner Style:** `10px`.
- **Background:** 표면 크림, 종이 테두리.
- **Shadow Strategy:** 기본은 낮고 부드러운 그림자. 강조 카드에는 테두리와 옅은 틴트를 추가한다.
- **Internal Padding:** `16px 18px`.

### Inputs / Fields
- **Style:** 흰색 배경, `1.5px` 따뜻한 테두리, `8px` 모서리, 최소 높이 `44px`.
- **Focus:** 수확 주황 `3px` 키보드 포커스 외곽선.
- **Error / Disabled:** 비활성은 투명도를 낮추고, 오류는 베리 틴트와 오류 텍스트로 설명한다.

### Navigation
- **Style:** 깊은 농지 초록의 화면 상단 고정 헤더. 현재 탭은 밝은 표면에 짙은 초록 텍스트로 구분하며, 작은 화면에서는 탭이 줄바꿈된다.

## Do's and Don'ts

### Do:
- **Do** `frontend/src/app/styles.css`의 CSS 변수와 전역 컴포넌트 규칙을 시각 스타일의 단일 기준으로 사용한다.
- **Do** 주요 버튼과 입력을 최소 `44px` 높이로 유지한다.
- **Do** 상태를 색만으로 전달하지 말고 라벨과 함께 보여준다.
- **Do** `prefers-reduced-motion`을 존중하고 키보드 포커스를 눈에 띄게 표시한다.

### Don't:
- **Don't** 작은 본문 글자나 낮은 대비에 의존하지 않는다.
- **Don't** 농지 초록·수확 주황·종이색 팔레트와 무관한 장식용 그라디언트를 추가하지 않는다.
- **Don't** 기존 농장주·일손 용어와 업무 흐름을 시각 개선을 이유로 바꾸지 않는다.
- **Don't** 이모지를 아이콘 체계나 상태 전달의 유일한 수단으로 사용하지 않는다.
