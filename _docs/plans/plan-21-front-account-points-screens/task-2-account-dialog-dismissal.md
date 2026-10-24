# task-2-account-dialog-dismissal

## 읽어야 할 파일

- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `front/AGENTS.md`
- `front/src/screens/AccountScreen.tsx`
- `front/src/components/ui.tsx`

## 원인

현재 `AccountScreen`은 닫기와 Android 뒤로 가기에서 `setDialog(null)`을 호출한다. `Modal`은 `animationType="fade"`로 닫히는데, 제목과 본문은 각각 `settings`, `help` 이외의 모든 값에서 앱 정보를 렌더링한다. 따라서 닫히는 동안 `dialog === null`인 프레임에는 앱 정보가 표시된다. 사용자가 재생 설정·이용 안내에서 닫기를 누를 때 앱 정보가 잠깐 보이는 증상과 일치한다.

## 작업

변경 가능한 파일은 `front/src/screens/AccountScreen.tsx` 하나다.

1. 팝업의 표시 여부와 선택된 내용을 분리한다. 닫기나 `onRequestClose`에서는 표시 여부만 `false`로 바꾸고, 종료 애니메이션 동안 마지막으로 선택한 내용을 유지한다.
2. 재생 설정·이용 안내·앱 정보 메뉴는 해당 내용을 선택하고 팝업을 연다. 앱 정보를 선택했을 때만 앱 정보 제목과 본문이 렌더링되게 한다.
3. 다른 화면 구조나 포인트 기능은 수정하지 않는다.

### 주요 로직 코드 또는 변경 예시

```tsx
type AccountDialog = 'settings' | 'help' | 'about' | null;
const [dialog, setDialog] = useState<AccountDialog>(null);
const [dialogVisible, setDialogVisible] = useState(false);
const openDialog = (next: Exclude<AccountDialog, null>) => {
  setDialog(next);
  setDialogVisible(true);
};
const closeDialog = () => setDialogVisible(false);

<MenuItem icon="settings" label="재생 설정" onPress={() => openDialog('settings')} />
<MenuItem icon="help-circle" label="이용 안내" onPress={() => openDialog('help')} />
<MenuItem icon="info" label="앱 정보" onPress={() => openDialog('about')} />
<Modal visible={dialogVisible} transparent animationType="fade" onRequestClose={closeDialog}>
  {dialog !== null && <View style={styles.modalBackdrop}>
    <View accessibilityRole="alert" style={styles.dialog}>
      <AppText weight="bold" style={styles.dialogTitle}>
        {dialog === 'settings' ? '재생 설정' : dialog === 'help' ? '이용 안내' : '앱 정보'}
      </AppText>
      {dialog === 'settings' ? <View style={styles.settingList}>
        <SettingItem label="자막 표시" />
        <SettingItem label="다음 회차 자동 재생" />
        <SettingItem label="화질" />
        <AppText style={styles.muted}>설정 기능은 준비 중이에요.</AppText>
      </View> : dialog === 'help'
        ? <AppText style={styles.dialogCopy}>현재 포인트 기능은 화면만 준비되어 있어요. 포인트 조회와 사용은 아직 제공되지 않아요.</AppText>
        : <AppText style={styles.dialogCopy}>AI DRAMA{'\n'}드라마를 위한 체험 화면</AppText>}
      <Button label="닫기" onPress={closeDialog} />
    </View>
  </View>}
</Modal>
```

닫는 시점에 `dialog`를 `null`로 초기화하지 않는다. 팝업이 보이지 않는 동안 마지막 선택 값이 남아 있어도 사용자에게 노출되지 않으며, 다음 메뉴를 열 때 새 값으로 교체된다.

검증 명령:

- `npm --prefix front run typecheck`
- `npm --prefix front run test`
- `npm --prefix front run export`

수동 확인: 내 정보에서 재생 설정 → 닫기, 이용 안내 → 닫기, 앱 정보 → 닫기를 각각 실행한다. 앞의 두 팝업 종료 중 앱 정보가 잠깐 보이지 않고, 앱 정보 메뉴는 정상 내용을 표시해야 한다. Android 뒤로 가기로 닫는 동작도 같은 기준으로 확인한다.

완료 조건: 어떤 팝업을 닫아도 종료 중 내용이 다른 팝업으로 바뀌지 않으며, 세 메뉴의 열기·닫기가 유지된다.
