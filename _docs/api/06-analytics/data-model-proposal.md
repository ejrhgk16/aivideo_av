# 분석 데이터 모델 제안 (검토용 사본)

> 이 파일은 리뷰어가 git에서 볼 수 있게 둔 검토용 사본이다. 데이터 모델의 기준 문서는 `_docs/AI_DRAMA_data_model/`이며, 팀은 이 폴더를 git 밖에서 관리한다(`.gitignore`). 아래 내용은 기준 문서의 로컬 사본에 같은 형식으로 반영해 두었다. 두 문서가 다르면 기준 문서를 따른다.
>
> 상태: 제안. 아직 구현되지 않았다. 테이블은 back의 TypeORM 마이그레이션으로만 만들고, 관리자 사이트는 일별 집계를 읽기만 한다.

## 근거

- 관리자 지표 정의서 초안 v0.1(2026-11-25) 1~6장의 결정을 따른다. 노출은 빼꼼에서 작품 쇼츠가 화면에 뜬 횟수, 조회는 본편 재생이 시작된 횟수(유튜브 기준), 비로그인 사용자도 수집, 개인 식별자가 있는 원본은 90일 뒤 삭제하고 일별 집계는 계속 보관, 조회율은 빼꼼 노출 뒤 같은 기기에서 24시간 안에 그 작품 본편을 재생한 비율, 회차 화면에는 노출수·조회율이 없다. 정의서는 저장소 밖에서 관리하며, 이 제안에 필요한 결정은 이 문서와 [분석 이벤트 수집 API](events.md)에 모두 옮겼다.
- 기준 문서 `00-overview/scope.md`는 지금 "이 결정 전에는 인증·결제 SDK, 개인정보 열, 분석 집계 테이블을 추측으로 추가하지 않는다"고 적고 있고, `README.md`는 분석 집계 테이블을 범위 제외로 둔다. 위 정의서가 그 제품 결정이므로 문구 변경을 함께 제안한다([기존 문서 문구 변경](#기존-문서-문구-변경)).
- 수집 계약은 [분석 이벤트 수집 API](events.md)를 따른다.

## 변경 요약

| 위치(`_docs/AI_DRAMA_data_model/` 기준) | 변경 |
| --- | --- |
| `06-analytics/` | 새 도메인. README와 테이블 5개 |
| `README.md` | 문서 구조 행, 테이블 수 메모, 범위 제외 문구 |
| `00-overview/README.md` | 도메인 관계와 전체 테이블에 analytics 추가 |
| `00-overview/scope.md` | 범위 문장, 화면 표, 저장하지 않는 값, 인덱스 표, 제품 결정 표와 마지막 문장 |
| `00-overview/ERD.md` | analytics 관계 5줄과 설명 한 문장 |
| `00-overview/common-rules.md` | 범위 문장, 관계와 삭제의 분석 원본 예외 한 줄 |

## 06-analytics 도메인

정의서의 [미정] 항목은 정의서의 추천안을 따르고 `추천`으로, 이 문서에서 새로 정한 조정 가능한 값은 `제안값`으로 표시한다.

관리자 대시보드 지표를 위한 빼꼼 노출·본편 재생 원본과 KST 일별 집계를 관리한다. 원본에는 설치 ID와 사용자 ID가 있어 90일 뒤 지우고, 개인 식별자가 없는 일별 집계는 계속 보관한다. 테이블은 back 마이그레이션으로만 만들고, 관리자 사이트는 일별 집계를 읽기만 한다.

| 테이블 | 설명 |
| --- | --- |
| [feed_impressions](#feed_impressions) | 빼꼼 노출 원본. 90일 보관 |
| [playback_sessions](#playback_sessions) | 본편 재생 세션당 1행의 누적값. 90일 보관 |
| [episode_daily_stats](#episode_daily_stats) | 회차·KST 날짜별 조회·참여 조회·완주·시청 시간 |
| [episode_daily_reach](#episode_daily_reach) | 회차·KST 날짜·5% 구간별 도달 조회 수 |
| [drama_daily_stats](#drama_daily_stats) | 작품·KST 날짜별 빼꼼 노출과 24시간 전환 |

### 관계

- feed_impressions.drama_id → dramas.id
- playback_sessions.video_id → content_videos.id, episode_id → episodes.id, drama_id → dramas.id
- 두 원본의 user_id → users.id는 NULL을 허용하는 논리 참조다.
- episode_daily_stats와 episode_daily_reach는 playback_sessions에서, drama_daily_stats는 feed_impressions와 playback_sessions에서 만든다.
- 일별 집계 테이블에는 user_id와 install_id가 없다.

### 시각과 KST 날짜

- 모든 시각 열은 애플리케이션이 UTC Date로 넣는다. 삭제 작업과 날짜 계산이 이 값을 기준으로 하므로, 세션 시간대에 따라 달라지는 DB 기본값 CURRENT_TIMESTAMP(3)에 기대지 않는다(공통 규칙의 시간 저장·비교 기준).
- stat_date_kst가 D인 하루는 UTC `[D-1 15:00:00.000, D 15:00:00.000)` 범위다.
- 노출은 occurred_at, 조회·참여 조회·완주·시청 시간·도달은 세션의 started_at, 전환은 그 노출의 occurred_at으로 날짜를 정한다.
- 애플리케이션이 날짜의 UTC 범위를 계산해 `>= :from AND < :to` 조건으로 넘긴다. 열에 9시간을 더하는 식(DATE_ADD, CONVERT_TZ)을 쓰지 않는다. 인덱스를 쓰고 MySQL 시간대 테이블에 기대지 않기 위해서다.

### 조회 판정

started_at이 있는 세션이 조회 후보다. started_at은 playback_start나 실제 재생 값이 있는 진행·종료 이벤트로만 정해지므로 첫 장면 전에 떠난 세션은 후보가 아니다. 아래 순서로 걸러 내고 합친다.

1. **동시 재생 제외:** 같은 install_id의 두 세션에서 재생 구간 `[started_at, last_played_at]`이 겹치면 나중에 시작한 세션을 조회에서 뺀다. last_played_at이 NULL이면 started_at으로 본다. last_played_at은 watched_ms가 실제로 늘어난 시각이라, 일시정지한 화면이 나중에 보낸 백그라운드 전환·종료 이벤트로는 구간이 늘지 않는다. 화면 전환 때 생기는 이벤트 시각 오차는 5초까지 겹침으로 보지 않는다(제안값).
2. **30초 안 다시 열기(추천):** 같은 install_id·episode_id에서 세션의 started_at이 직전 세션의 last_event_at(화면을 떠나며 보낸 마지막 이벤트 시각) 뒤 30초 안이면 직전 조회에 합친다. 합친 조회의 날짜와 duration_ms는 첫 세션의 값이다. 첫 세션의 날짜가 이미 고정됐으면 뒤 세션은 조회로 세지 않는다.
3. **발급되지 않은 세션:** 수집 API가 이벤트를 받을 때 이미 버린다.
4. **1분 안 반복 열기:** 같은 설치 ID로 같은 회차를 1분 안에 여러 번 연 것은 2번 규칙으로 하나의 조회로 합쳐지므로 별도 상한을 두지 않는다. 설치 ID를 바꾼 위조 반복은 세션 발급의 IP 한도([재생 세션 ID 발급](events.md#재생-세션-id-발급))로 막는다. 2번 규칙을 채택하지 않으면 상한을 따로 정한다.

조회 1건의 값은 아래와 같다. duration_ms는 세션 발급 때 저장한 영상 길이다.

| 값 | 계산 |
| --- | --- |
| 시청 시간 | min(합친 세션들의 watched_ms 합, duration_ms) |
| 도달 구간 | floor(min(합친 세션들의 max_reached_ms 최댓값, duration_ms) × 20 ÷ duration_ms). 0~20 |
| 참여 조회 | 시청 시간 ≥ 3000ms |
| 완주 | 도달 구간 ≥ 18(90% 지점, 추천). 이탈 곡선의 18번째 점과 같은 판정이다 |
| 회차 길이 | duration_ms. 평균 시청 비율의 분모에 더한다 |

### 노출 판정

- 같은 install_id·drama_id에서 마지막으로 센 노출 뒤 30분 이상 지난 첫 노출을 센다(고정 창, 추천). 첫 노출은 센다. 예를 들어 같은 카드를 0분부터 110분까지 10분마다 다시 보면 0·30·60·90분의 4회를 센다.
- 직전 노출이 앞 날짜에 있어도 이어서 따진다. 원본 노출 사이가 30분 이상 벌어진 곳에서는 앞 기록과 상관없이 새로 세므로, 다시 계산할 때는 날짜 시작 전의 그런 곳부터 따라가면 처음부터 따라간 결과와 같다.
- 센 노출의 occurred_at 뒤 24시간 안(`occurred_at < started_at <= occurred_at + 24시간`)에 같은 install_id로 같은 작품의 조회가 시작됐으면 전환된 노출이다. 조회는 위 조회 판정을 거친 것만 쓴다.
- 작품 조회율은 전환된 노출 수 ÷ 센 노출 수다. 조회는 홈·작품 소개·이어보기에서도 생기므로 조회수 ÷ 노출수로 계산하지 않는다.

### 일별 집계 작업

- 매일 00:10 KST에 KST 날짜 D-1, D-2, D-3을 다시 계산한다. D-4 이전 날짜는 고정하고 다시 고치지 않는다.
- 날짜 하나를 계산할 때 세 집계 테이블에서 그 날짜의 행을 지우고 다시 넣는 일을 한 트랜잭션으로 한다. 같은 날짜를 여러 번 계산해도 결과가 같다.
- 백엔드는 상주하지 않는 서버리스 인스턴스로 실행되므로 서버 프로세스 안의 타이머(`@nestjs/schedule` 등)를 쓰지 않는다. 외부 스케줄러가 back 빌드 결과의 node CLI를 매일 실행한다(기존 `db:seed`와 같은 방식). 원본 삭제 작업도 같다.
- 여러 실행이 겹치지 않도록 DB에 잠금을 건다.
- 수집 API는 48시간이 지난 이벤트를 받지 않는다. 날짜 D는 D+3 00:10 계산 뒤 고정되므로 늦게 온 이벤트도 대부분 반영된다. 다만 자정을 넘긴 재생의 뒤쪽 이벤트나, D의 노출에 대한 다음 날 전환 재생이 48시간 가까이 늦게 오면 빠질 수 있다.
- 오늘 날짜는 다음 날 집계 전까지 집계 테이블에 없다. 관리자 사이트의 기간은 [관리자 사이트 읽기](#관리자-사이트-읽기)를 따른다.

### 관리자 사이트 읽기

- 대시보드 기간은 어제(KST)까지다. 최근 N일은 [어제 − N + 1, 어제], 증감을 비교하는 이전 기간은 그 앞의 같은 길이다. 오늘을 넣으면 현재 기간만 하루가 비어 증감이 늘 낮게 나온다(7일이면 약 −14%). 화면에 '어제까지'를 표시한다. 최근 3일 값은 늦게 온 이벤트로 조금 바뀔 수 있다.
- 평균 시청 비율은 Σwatch_ms ÷ Σduration_ms_sum(episode_daily_stats), 조회율은 Σconversions ÷ Σimpressions(drama_daily_stats)다.
- 지금 관리자 코드는 기간 끝이 오늘이고 평균 시청 비율의 분모가 조회수 × episodes.duration_ms다. 예시 숫자를 실데이터로 바꾸는 작업에서 이 기준으로 함께 고친다.

### 원본 삭제 작업

- 매일 집계 작업 뒤 feed_impressions는 occurred_at, playback_sessions는 created_at이 90일보다 오래된 행을 지운다. 잠금 시간을 줄이도록 나눠 지운다.
- 탈퇴한 사용자는 그 user_id가 들어간 원본 행과, 그 행들에 나온 install_id의 user_id가 NULL인 원본 행을 지운다. 같은 기기를 함께 쓴 다른 사람의 비로그인 기록도 지워질 수 있지만 다른 로그인 사용자의 행은 지우지 않는다. 탈퇴 처리 흐름은 아직 없으므로 탈퇴를 구현하는 작업에서 함께 붙인다.
- 설치 ID 기준 삭제 요청은 그 install_id의 원본 행을 지운다.
- 집계는 원본이 지워지기 전에 고정된다. 90일이 지난 날짜는 원본으로 다시 계산할 수 없으므로 정의를 바꿔도 그 이전 집계에는 반영되지 않는다.

### 개인 식별자

- 원본의 install_id(앱이 만든 무작위 UUID)와 user_id가 개인 식별자다. 기기 고유번호, 광고 ID, IP 주소, User-Agent는 저장하지 않는다.
- 일별 집계에는 콘텐츠·날짜·구간별 합계만 두고 개인 식별자를 넣지 않는다.

## 테이블 정의

### feed_impressions

#### 목적

빼꼼(세로 미리보기 피드)에서 작품의 쇼츠 카드가 화면에 뜬 노출 원본을 저장한다. 90일 뒤 지운다.

#### 컬럼 정의

| 열 | 타입 / 제약 | 설명 |
| --- | --- | --- |
| id | BIGINT UNSIGNED AUTO_INCREMENT PK | 내부 노출 키. 계속 쌓고 지우는 대량 원본이라 BIGINT를 쓴다 |
| event_uuid | CHAR(36) NOT NULL UNIQUE | 앱이 만든 eventId. 재전송 중복 방지 |
| install_id | CHAR(36) NOT NULL | 앱 설치 ID |
| user_id | INT UNSIGNED NULL | 전송 요청의 Access JWT 사용자. 익명은 NULL |
| drama_id | INT UNSIGNED NOT NULL | 노출된 작품 |
| feed_position | SMALLINT UNSIGNED NOT NULL CHECK (feed_position BETWEEN 1 AND 1000) | 빼꼼 피드의 카드 순서 |
| occurred_at | DATETIME(3) NOT NULL | 기기 시계를 보정한 노출 시각 |
| created_at | DATETIME(3) NOT NULL | 서버 수신 시각 |

#### 관계와 인덱스

- drama_id → dramas.id (INT UNSIGNED)
- user_id → users.id (INT UNSIGNED, NULL 허용 논리 참조)
- 인덱스: (occurred_at), (install_id, drama_id, occurred_at), (user_id)

#### 규칙

- 수정하지 않는다. 같은 event_uuid는 한 번만 저장하고 다시 오면 무시한다.
- 30분 고정 창으로 반복 노출을 빼는 일과 24시간 전환 판정은 일별 집계에서 한다. 원본은 받은 그대로 둔다.
- occurred_at이 90일보다 오래된 행은 삭제 작업이 지운다.

### playback_sessions

#### 목적

회차 재생 API가 발급한 본편 재생 세션마다 한 행을 두고 누적 시청 시간과 가장 먼 도달 위치를 갱신한다. 조회수, 시청 시간, 완주, 구간 도달의 원본이다. 90일 뒤 지운다.

#### 컬럼 정의

| 열 | 타입 / 제약 | 설명 |
| --- | --- | --- |
| id | BIGINT UNSIGNED AUTO_INCREMENT PK | 내부 세션 키. 계속 쌓고 지우는 대량 원본이라 BIGINT를 쓴다 |
| uuid | CHAR(36) NOT NULL UNIQUE | 재생 API가 응답한 playbackSessionId |
| video_id | INT UNSIGNED NOT NULL | 재생한 content_videos.id. EPISODE/FULL 영상 |
| episode_id | INT UNSIGNED NOT NULL | 발급 시점의 회차 |
| drama_id | INT UNSIGNED NOT NULL | 발급 시점의 작품 |
| user_id | INT UNSIGNED NULL | 발급 요청의 Access JWT 사용자. 익명은 NULL |
| install_id | CHAR(36) NULL | 이 세션에 처음 반영된 재생 이벤트 묶음의 설치 ID. 정해지기 전에는 NULL |
| duration_ms | INTEGER NOT NULL CHECK (duration_ms > 0) | 발급 때 재생 API가 응답한 영상 길이 |
| started_at | DATETIME(3) NULL | playback_start나 실제 재생 값(watched_ms·max_reached_ms > 0)이 있는 진행·종료 이벤트 중 가장 이른 시각. NULL이면 재생되지 않은 세션 |
| last_played_at | DATETIME(3) NULL | watched_ms가 지금 값으로 늘어난 이벤트의 시각. 동시 재생 판정에 쓴다 |
| last_event_at | DATETIME(3) NULL | 받은 재생 이벤트 중 가장 늦은 시각. 30초 안 다시 열기 판정에 쓴다 |
| ended_at | DATETIME(3) NULL | 받은 playback_end 중 가장 이른 시각 |
| watched_ms | INTEGER NOT NULL DEFAULT 0 CHECK (watched_ms >= 0) | 받은 누적 실제 재생 시간 중 가장 큰 값 |
| max_reached_ms | INTEGER NOT NULL DEFAULT 0 CHECK (max_reached_ms >= 0) | 실제 재생으로 도달한 가장 먼 위치. duration_ms를 넘지 않는다 |
| created_at, updated_at | DATETIME(3) | created_at은 세션 발급 시각 |

#### 관계와 인덱스

- video_id → content_videos.id (INT UNSIGNED)
- episode_id → episodes.id (INT UNSIGNED)
- drama_id → dramas.id (INT UNSIGNED)
- user_id → users.id (INT UNSIGNED, NULL 허용 논리 참조)
- 인덱스: (started_at), (install_id, started_at), (created_at), (user_id)
- episode_id와 drama_id는 다형성 참조인 content_videos를 거치지 않고 회차·작품별로 집계하도록 발급 때 함께 저장한다.

#### 규칙

- 재생 API가 URL을 발급할 때 install_id와 네 시각 열(started_at, last_played_at, last_event_at, ended_at)은 NULL, 누적값은 0으로 만든다.
- 재생 이벤트는 세션 행에 대한 UPDATE 한 문으로 반영한다. install_id가 NULL이거나 같은 값인 행만 갱신하고 NULL이면 이 묶음의 값으로 정한다. 갱신된 행이 없으면 그 이벤트를 버린다. 읽은 값을 고쳐 다시 쓰지 않으므로 동시에 들어온 묶음이 경합해도 설치 ID는 하나로 정해진다.
- 값은 한 방향으로만 바꾼다. started_at·ended_at은 더 이른 값, last_event_at·watched_ms·max_reached_ms는 더 큰 값을 남긴다. last_played_at은 watched_ms가 커질 때 그 이벤트 시각으로 바꾸고, 0이 아닌 같은 watched_ms가 더 이른 시각으로 오면 이른 시각으로 바꾼다.
- ended_at보다 늦은 이벤트는 반영하지 않는다. 앱은 종료한 세션에 이벤트를 보내지 않고, 다시 재생할 때 새 세션을 받는다. 이 규칙을 빼면 재전송이나 순서 뒤바뀜에도 결과가 같다.
- 조회 여부, 참여 조회, 완주는 저장하지 않고 일별 집계에서 계산한다.
- duration_ms는 앱이 도달 위치를 잰 영상 길이와 같아야 하므로 재생 API의 응답값(대표 FULL 영상의 content_videos.duration_ms)을 저장한다. 시청 시간 상한, 도달 구간, 평균 시청 비율의 분모(episode_daily_stats.duration_ms_sum)가 모두 이 값을 쓰므로, 회차 길이 기준(정의서의 episodes.duration_ms 통일 추천안)이 정해지기 전이나 대표 영상이 바뀐 뒤에도 서로 어긋나지 않는다.
- user_watch_progress(이어보기·시청 완료 표시)와 따로 둔다. 그 테이블은 사용자·영상당 한 행을 덮어써 재시청과 날짜별 이력이 남지 않으므로 지표용으로 넓히지 않는다.
- created_at이 90일보다 오래된 행은 삭제 작업이 지운다.

### episode_daily_stats

#### 목적

회차·KST 날짜별 조회수, 참여 조회수, 완주수, 시청 시간을 저장한다. 개인 식별자가 없어 계속 보관한다.

#### 컬럼 정의

| 열 | 타입 / 제약 | 설명 |
| --- | --- | --- |
| episode_id | INT UNSIGNED NOT NULL | 회차 |
| stat_date_kst | DATE NOT NULL | 한국 날짜 |
| views | INTEGER NOT NULL CHECK (views >= 0) | 조회 수 |
| engaged_views | INTEGER NOT NULL CHECK (engaged_views >= 0) | 시청 시간 3초 이상인 조회 수 |
| completions | INTEGER NOT NULL CHECK (completions >= 0) | 도달 구간 18 이상(90%)인 조회 수 |
| watch_ms | BIGINT NOT NULL CHECK (watch_ms >= 0) | 조회별 시청 시간(영상 길이 상한)의 합 |
| duration_ms_sum | BIGINT NOT NULL CHECK (duration_ms_sum >= 0) | 조회별 duration_ms의 합. 평균 시청 비율의 분모 |
| created_at, updated_at | DATETIME(3) | 계산 시각 |
| PK | (episode_id, stat_date_kst) | 회차·날짜별 한 행 |

#### 관계와 인덱스

- episode_id → episodes.id (INT UNSIGNED)
- 인덱스: (stat_date_kst). 날짜 단위 재계산에 쓴다.

#### 규칙

- 조회가 있는 회차·날짜만 행을 만든다. 행이 없는 날은 0이다.
- 작품 조회수는 소속 회차 행의 합이다.
- 평균 시청 비율은 Σwatch_ms ÷ Σduration_ms_sum, 완주율은 Σcompletions ÷ Σviews, 이탈률은 1 − 완주율이다. 조회마다 시청 시간 상한과 같은 길이를 분모에 더하므로 평균 시청 비율은 100%를 넘지 않는다.
- 회차 단위 노출수는 두지 않는다. 노출은 작품 단위다.
- 최근 3일은 매일 다시 계산하고 그 이전은 고정한다.

### episode_daily_reach

#### 목적

회차·KST 날짜별로 5% 구간 점(0%, 5%, …, 100%)마다 그 지점까지 도달한 조회 수를 저장한다. 공개 이후 전체 기간의 구간 이탈 곡선과 도달률을 이 테이블의 합으로 만든다. 개인 식별자가 없어 계속 보관한다.

#### 컬럼 정의

| 열 | 타입 / 제약 | 설명 |
| --- | --- | --- |
| episode_id | INT UNSIGNED NOT NULL | 회차 |
| stat_date_kst | DATE NOT NULL | 한국 날짜 |
| bucket | TINYINT UNSIGNED NOT NULL CHECK (bucket BETWEEN 0 AND 20) | 구간 점. k는 회차 길이의 k × 5% 지점 |
| reached_views | INTEGER NOT NULL CHECK (reached_views >= 0) | 그날 조회 중 도달 구간이 bucket 이상인 수 |
| created_at, updated_at | DATETIME(3) | 계산 시각 |
| PK | (episode_id, stat_date_kst, bucket) | 회차·날짜·구간 점별 한 행 |

#### 관계와 인덱스

- episode_id → episodes.id (INT UNSIGNED)
- 인덱스: (stat_date_kst). 날짜 단위 재계산에 쓴다.

#### 규칙

- 조회가 있는 회차·날짜마다 bucket 0~20의 21행을 만든다. bucket 0의 값은 그날 조회 수와 같다.
- 이탈 곡선의 점 k는 공개 이후 모든 날짜의 reached_views(bucket = k) 합 ÷ reached_views(bucket = 0) 합이다. 기간 선택과 무관하다.
- 25/50/75/100% 도달률은 bucket 5/10/15/20 점이다. bucket 18의 값은 같은 날짜 episode_daily_stats.completions와 같다.
- 최근 3일은 매일 다시 계산하고 그 이전은 고정한다.

### drama_daily_stats

#### 목적

작품·KST 날짜별 빼꼼 노출 수와 그중 24시간 안에 본편 조회로 이어진 노출 수를 저장한다. 작품 노출수와 조회율(빼꼼 전환율)의 원천이다. 개인 식별자가 없어 계속 보관한다.

#### 컬럼 정의

| 열 | 타입 / 제약 | 설명 |
| --- | --- | --- |
| drama_id | INT UNSIGNED NOT NULL | 작품 |
| stat_date_kst | DATE NOT NULL | 노출의 한국 날짜 |
| impressions | INTEGER NOT NULL CHECK (impressions >= 0) | 30분 고정 창으로 반복 노출을 뺀 빼꼼 노출 수 |
| conversions | INTEGER NOT NULL CHECK (conversions >= 0 AND conversions <= impressions) | 그중 같은 기기에서 24시간 안에 그 작품 본편 조회가 시작된 노출 수 |
| created_at, updated_at | DATETIME(3) | 계산 시각 |
| PK | (drama_id, stat_date_kst) | 작품·날짜별 한 행 |

#### 관계와 인덱스

- drama_id → dramas.id (INT UNSIGNED)
- 인덱스: (stat_date_kst). 날짜 단위 재계산에 쓴다.

#### 규칙

- 노출이 있는 작품·날짜만 행을 만든다. 행이 없는 날은 0이다.
- 전환은 그 노출의 날짜에 넣는다. 조회가 다음 날 시작돼도 같다.
- 기간 조회율은 Σconversions ÷ Σimpressions다. 노출이 0이면 값이 없다.
- 최근 3일은 매일 다시 계산하고 그 이전은 고정한다.

## 기존 문서 문구 변경

### `README.md`

- 문서 구조 표에 행을 더한다: `| [06-analytics](06-analytics/README.md) | 관리자 지표용 빼꼼 노출·본편 재생 원본과 일별 집계(제안) |`
- 테이블 수 목록 뒤에 더한다: "관리자 지표용 analytics 5개 테이블은 제안 상태다. 승인되면 합계는 29개가 된다."
- 범위 제외
  - 현재: "창작마당, 카페, AI 채팅, 구독, 다운로드, 별도 추천 엔진, 알림, 분석 집계 테이블은 현재 기획 범위에 포함하지 않는다."
  - 변경: "창작마당, 카페, AI 채팅, 구독, 다운로드, 별도 추천 엔진, 알림은 현재 기획 범위에 포함하지 않는다. 분석 테이블은 관리자 지표 정의(2026-11-25 결정)에 필요한 06-analytics의 원본과 일별 집계만 두며, 퍼널·코호트·광고 어트리뷰션 같은 범용 마케팅 분석은 포함하지 않는다."

### `00-overview/scope.md`

- 검토 범위와 결론: "이 범위는 24개 테이블로 처리한다." 뒤에 "관리자 지표 수집·집계는 06-analytics의 5개 테이블로 따로 둔다(제안)."를 더한다.
- 화면과 데이터 모델 표에 행을 더한다: `| 관리자 지표 | episode_daily_stats, episode_daily_reach, drama_daily_stats |`
- 저장하지 않는 값
  - 현재: "초기 TOP 3은 편집 컬렉션에 저장하며 실제 시청 수나 매출 순위는 저장하지 않는다."
  - 변경: "초기 TOP 3은 편집 컬렉션에 저장하며 실제 시청 수나 매출 순위로 정하지 않는다. 시청 수는 관리자 지표용 일별 집계에만 저장한다."
- 주요 조회와 인덱스 표에 행을 더한다: `| 관리자 일별 지표 | episode_daily_stats(episode_id, stat_date_kst), episode_daily_reach(episode_id, stat_date_kst, bucket), drama_daily_stats(drama_id, stat_date_kst) |`
- 구현 전에 확정할 제품 결정 표에 행을 더한다: `| 관리자 지표 | 노출·조회·조회율 정의, 비로그인 수집, 원본 90일·집계 계속 보관을 결정했다(2026-11-25). 남은 [미정] 항목은 추천안으로 06-analytics에 반영했다 |`
- 마지막 문장
  - 현재: "이 결정 전에는 인증·결제 SDK, 개인정보 열, 분석 집계 테이블을 추측으로 추가하지 않는다."
  - 변경: "이 결정 전에는 인증·결제 SDK, 개인정보 열을 추측으로 추가하지 않는다. 분석 테이블은 관리자 지표 결정에 따른 06-analytics의 범위만 두며, 그 밖의 분석 집계 테이블은 별도 제품 결정 전에 추가하지 않는다."

### `00-overview/README.md`

- 도메인 관계 블록 끝에 더한다.

~~~text
analytics (제안)
  ├─ feed_impressions ─ drama_daily_stats
  └─ playback_sessions ─ episode_daily_stats / episode_daily_reach
~~~

- 전체 테이블 표에 행을 더한다: `| analytics (제안) | feed_impressions, playback_sessions, episode_daily_stats, episode_daily_reach, drama_daily_stats |`

### `00-overview/ERD.md`

- mermaid 블록 끝에 더한다.

~~~text
  dramas ||--o{ feed_impressions : shown_in_feed
  content_videos ||--o{ playback_sessions : played_in
  episodes ||--o{ episode_daily_stats : summarized_daily
  episodes ||--o{ episode_daily_reach : reached_daily
  dramas ||--o{ drama_daily_stats : summarized_daily
~~~

- 설명 문단의 "episode_entitlements는 유료 회차를 실제로 연 기록이다." 뒤에 "analytics 테이블(제안)의 user_id는 NULL을 허용하는 users.id 논리 참조이며, 일별 집계 테이블에는 사용자 열이 없다."를 더한다.

### `00-overview/common-rules.md`

- 관계와 삭제: "삭제 대신 WITHDRAWN, HIDDEN, INACTIVE 같은 상태 변경을 우선한다." 뒤에 "보관 기간이 정해진 분석 원본(06-analytics의 feed_impressions, playback_sessions)은 예외로 물리 삭제하며, 계속 쌓고 지우는 대량 행이라 BIGINT UNSIGNED 기본 키를 쓴다."를 더한다. 분석 테이블의 시각 저장은 기존 '시간 저장·비교 기준'(UTC_TIMESTAMP(3) 또는 애플리케이션 Date)을 그대로 따르므로 공통 규칙에 새 문장을 더하지 않고 06-analytics에 적용만 적는다.
- 범위
  - 현재: "현재 문서는 콘텐츠 카탈로그, 사용자 감상, 포인트, 회차 해제, 광고 보상, 충전, 운영 편성까지만 다룬다."
  - 변경: "현재 문서는 콘텐츠 카탈로그, 사용자 감상, 포인트, 회차 해제, 광고 보상, 충전, 운영 편성과 관리자 지표 수집·집계(06-analytics, 제안)까지만 다룬다."
