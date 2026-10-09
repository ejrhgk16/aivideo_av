# 장르 목록 API

## 목적

홈의 장르 탐색과 장르 필터에 사용할 장르 목록을 제공한다.

## 인증

불필요

## Endpoint

### GET /genres

#### 200 Response

응답 본문은 장르 배열이다.

```json
[
  {
    "id": 1,
    "code": "ROMANCE",
    "name": "로맨스"
  }
]
```

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `id` | number | 장르 식별자 |
| `code` | string | 시스템 장르 코드 |
| `name` | string | 화면 표시명 |

## 정렬 규칙

장르는 `genres.display_order` 오름차순으로 반환한다.

## 관련 데이터 모델

- `genres`
