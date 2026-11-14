KTOWN 22 → BAPCARRY 22 · Chosun Ok 복사

1. ZIP을 C:\pwa\chosun22-copy 폴더에 압축 해제하세요.
2. RUN.cmd를 실행하세요. BAPCARRY 프로젝트(miskaxvfipywmlvxelrs)의
   service_role 키를 입력합니다. 입력 내용은 화면에 표시되거나 파일에 저장되지 않습니다.
   KTOWN 키는 필요하지 않습니다. Node.js 18 이상이 필요합니다.
3. SUCCESS가 나오면 생성된 BAPCARRY_22_Import.sql을 메모장으로 여세요.
   전체 복사 후 BAPCARRY Supabase → SQL Editor에 붙여 넣고 Run을 누르세요.
   import-template.sql은 직접 실행하지 마세요.
4. 결과가 menus=113, categories=15, layers=6인지 확인하세요.

복사 대상: 메뉴 113개, 카테고리 15개, 옵션 그룹 2개, 옵션 7개,
레이어 6개, 헤더 및 웹사이트 디자인 설정, 필요한 이미지 파일.

메뉴와 옵션에는 새 ID를 사용합니다. 메뉴 연결을 함께 재설정합니다.
이미지는 BAPCARRY의 별도 경로에 업로드하고 SHA-256으로 원본과 비교합니다.
모든 이미지 복사 성공 후에만 가져오기 SQL을 생성합니다.
파일 복사 중 실패하면 media-report.json을 보내주세요. 다시 실행해도 됩니다.

기존 BAPCARRY 22의 메뉴와 레이어는 제출된 자료에서 비어 있었습니다.
그 사이 새 데이터가 등록되면 SQL이 중단되며 변경은 취소됩니다.
성공 후 같은 SQL을 다시 실행해도 중복 복사하지 않고 중단됩니다.

결제 계정, 소유자, 주문 내역, 도메인, 영업시간, PICKUP/DELIVERY 사용 설정은
변경하지 않습니다. 웹사이트 공개/활성화도 자동으로 바꾸지 않습니다.
