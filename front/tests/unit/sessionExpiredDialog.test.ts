import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const ts = require(resolve(process.cwd(), 'node_modules/typescript')) as typeof import('typescript');
type Node = { type: unknown; props: Record<string, unknown> };
const jsx = (type: unknown, props: Record<string, unknown>): Node => ({ type, props });

function loadComponent() {
  const source = readFileSync(resolve(process.cwd(), 'src/components/SessionExpiredDialog.tsx'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const modules: Record<string, unknown> = {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { Modal: 'Modal', StyleSheet: { create: (value: unknown) => value }, View: 'View' },
    '@/components/ui': {
      AppText: (props: Record<string, unknown>) => jsx('AppText', props),
      Button: (props: Record<string, unknown>) => jsx('Button', props),
    },
    '@/common/theme/tokens': { colors: { muted: '#aaa', text: '#fff', surface: '#111', border: '#333' } },
  };
  const module = { exports: {} as Record<string, unknown> };
  vm.runInNewContext(compiled, { exports: module.exports, require: (id: string) => {
    if (!(id in modules)) throw new Error(`Unexpected module: ${id}`);
    return modules[id];
  } }, { filename: 'SessionExpiredDialog.js' });
  return module.exports.SessionExpiredDialog as (props: { visible: boolean; onDismiss: () => void; onLogin: () => void }) => Node;
}

function nodes(root: unknown): Node[] {
  if (Array.isArray(root)) return root.flatMap(nodes);
  if (root === null || typeof root !== 'object') return [];
  const current = root as Node;
  if (!('type' in current) || !('props' in current)) return [];
  if (typeof current.type === 'function') return nodes((current.type as (props: Record<string, unknown>) => unknown)(current.props));
  return [current, ...nodes(current.props.children)];
}

function loadRootLayout(sessionExpired: boolean) {
  const source = readFileSync(resolve(process.cwd(), 'src/app/_layout.tsx'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const pushes: unknown[] = [];
  const dismisses: number[] = [];
  const Stack = (props: Record<string, unknown>) => jsx('Stack', props);
  Stack.Screen = 'Stack.Screen';
  const modules: Record<string, unknown> = {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'expo-router': { Stack, useRouter: () => ({ push: (path: unknown) => pushes.push(path) }) },
    'expo-font': { useFonts: () => [true, null] },
    'expo-status-bar': { StatusBar: 'StatusBar' },
    'react-native': { ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: (value: unknown) => value }, View: 'View' },
    'react-native-safe-area-context': { SafeAreaProvider: (props: Record<string, unknown>) => jsx('SafeAreaProvider', props) },
    '@/common/theme/tokens': { colors: { background: '#000', accent: '#0f0' } },
    '@/features/user/UserProvider': {
      UserProvider: (props: Record<string, unknown>) => props.children,
      useUser: () => ({ sessionExpired, dismissSessionExpired: () => dismisses.push(1) }),
    },
    '@/components/SessionExpiredDialog': { SessionExpiredDialog: loadComponent() },
  };
  const module = { exports: {} as Record<string, unknown> };
  vm.runInNewContext(compiled, { exports: module.exports, require: (id: string) => {
    if (id.endsWith('.ttf')) return id;
    if (!(id in modules)) throw new Error(`Unexpected module: ${id}`);
    return modules[id];
  } }, { filename: '_layout.js' });
  const RootLayout = module.exports.default as () => Node;
  return { tree: RootLayout(), pushes, dismisses };
}

test('expiration dialog exposes one root modal, dismisses on close and only routes after login press', () => {
  const root = loadRootLayout(true);
  const rendered = nodes(root.tree);
  const modals = rendered.filter((node) => node.type === 'Modal');
  assert.equal(modals.length, 1);
  assert.equal(modals[0].props.visible, true);
  const text = rendered.filter((node) => node.type === 'AppText').map((node) => node.props.children).join('');
  assert.match(String(text), /로그인이 만료됐어요/);
  assert.match(String(text), /다시 로그인해 주세요/);
  assert.deepEqual(root.pushes, []);
  (modals[0].props.onRequestClose as () => void)();
  const close = rendered.find((node) => node.type === 'Button' && node.props.label === '닫기');
  const login = rendered.find((node) => node.type === 'Button' && node.props.label === '로그인');
  assert.ok(close && login);
  (close.props.onPress as () => void)();
  assert.equal(root.dismisses.length, 2);
  assert.deepEqual(root.pushes, []);
  (login.props.onPress as () => void)();
  assert.equal(root.dismisses.length, 3);
  assert.deepEqual(root.pushes, ['/login']);
});

test('hidden expiration dialog renders one invisible modal', () => {
  const Dialog = loadComponent();
  const tree = Dialog({ visible: false, onDismiss() {}, onLogin() {} });
  const modals = nodes(tree).filter((node) => node.type === 'Modal');
  assert.equal(modals.length, 1);
  assert.equal(modals[0].props.visible, false);
});
