import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
const ts = require(resolve(process.cwd(), 'node_modules/typescript')) as typeof import('typescript');

type Node = { type: unknown; props: Record<string, unknown>; key?: string };

function createDialog(platform: 'ios' | 'android' | 'web' = 'web', initialPoints = 120) {
  const source = readFileSync(resolve(process.cwd(), 'src/components/EpisodeUnlockDialog.tsx'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const state: unknown[] = [];
  const refs: { current: unknown }[] = [];
  const effects: { effect: () => void | (() => void); deps?: unknown[]; cleanup?: () => void }[] = [];
  const animations: ((result: { finished: boolean }) => void)[] = [];
  let hook = 0;
  let tree: Node | null = null;
  let needsRender = false;
  let props: Record<string, unknown>;
  let points = initialPoints;
  let purchaseCalls = 0;
  let purchase: () => Promise<unknown> = async () => ({ availablePoints: 70 });
  let setPointsCalls: number[] = [];

  const jsx = (type: unknown, config: Record<string, unknown>, key?: string): Node => ({ type, props: config, key });
  const react = {
    useState<T>(initial: T | (() => T)) {
      const index = hook++;
      if (!(index in state)) state[index] = typeof initial === 'function' ? (initial as () => T)() : initial;
      return [state[index] as T, (value: T | ((previous: T) => T)) => {
        state[index] = typeof value === 'function' ? (value as (previous: T) => T)(state[index] as T) : value;
        needsRender = true;
      }] as const;
    },
    useRef<T>(initial: T) {
      const index = hook++;
      refs[index] ??= { current: initial };
      return refs[index] as { current: T };
    },
    useEffect(effect: () => void | (() => void), deps?: unknown[]) {
      const index = hook++;
      const prior = effects[index];
      if (!prior || deps?.some((value, position) => !Object.is(value, prior.deps?.[position])) || (deps === undefined && prior.deps !== undefined)) {
        effects[index] = { effect, deps };
      }
    },
  };
  const mockAnimatedValue = {
    setValue() {},
    stopAnimation() {},
  };
  const modules: Record<string, unknown> = {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': {
      Modal: 'Modal', Pressable: 'Pressable', StyleSheet: { create: (value: unknown) => value }, View: 'View',
      Platform: { OS: platform },
      Animated: {
        Value: class { setValue() {} stopAnimation() {} },
        View: 'Animated.View',
        timing: () => ({
          start: (callback: (result: { finished: boolean }) => void) => { animations.push(callback); },
          stop() {},
        }),
      },
    },
    '@/components/ui': {
      AppText: (config: Record<string, unknown>) => jsx('Text', config),
      Button: (config: Record<string, unknown>) => jsx('Button', config),
      Icon: (config: Record<string, unknown>) => jsx('Icon', config),
    },
    '@/common/theme/tokens': { colors: { muted: '#aaa', accent: '#0f0', text: '#fff', surface: '#111', border: '#333', background: '#000', danger: '#f00' } },
    '@/features/economy/episodePurchase': {
      EpisodePurchaseError: class EpisodePurchaseError extends Error { constructor(public status: number, public errorCode?: string) { super(); } },
      purchaseEpisode: () => { purchaseCalls += 1; return purchase(); },
    },
    '@/features/user/UserProvider': {
      useUser: () => ({ user: { uuid: 'user-1' }, points, setPoints: (next: number) => { points = next; setPointsCalls.push(next); } }),
    },
  };
  const module = { exports: {} as Record<string, unknown> };
  vm.runInNewContext(compiled, {
    exports: module.exports,
    require: (id: string) => {
      if (!(id in modules)) throw new Error(`Unexpected module: ${id}`);
      return modules[id];
    },
  }, { filename: 'EpisodeUnlockDialog.js' });
  const Component = module.exports.EpisodeUnlockDialog as (input: Record<string, unknown>) => Node;

  function commit() {
    let iterations = 0;
    do {
      needsRender = false;
      hook = 0;
      tree = Component(props);
      for (let index = 0; index < effects.length; index += 1) {
        const current = effects[index];
        if (!current) continue;
        const next = current.effect();
        if (typeof next === 'function') current.cleanup = next;
        current.effect = () => undefined;
      }
      iterations += 1;
      assert.ok(iterations < 10, 'component effects did not settle');
    } while (needsRender);
    return tree;
  }
  function nodes(root: unknown): Node[] {
    if (Array.isArray(root)) return root.flatMap(nodes);
    if (root === null || typeof root !== 'object') return [];
    const current = root as Node;
    if (!('type' in current) || !('props' in current)) return [];
    if (typeof current.type === 'function') {
      return nodes((current.type as (input: Record<string, unknown>) => unknown)(current.props));
    }
    return [current, ...nodes(current.props.children)];
  }
  function text(root: unknown): string {
    if (typeof root === 'string' || typeof root === 'number') return String(root);
    if (Array.isArray(root)) return root.map(text).join('');
    if (root === null || typeof root !== 'object') return '';
    return text((root as Node).props?.children);
  }
  function find(type: unknown, name?: string): Node {
    const found = nodes(tree).find((node) => node.type === type
      && (name === undefined || node.props.accessibilityLabel === name || node.props.label === name));
    assert.ok(found, `missing ${String(type)} ${name ?? ''}`);
    return found;
  }
  function invoke(node: Node, name: string) {
    const handler = node.props[name];
    assert.equal(typeof handler, 'function');
    (handler as () => void)();
  }
  function update(next: Record<string, unknown>) { props = { ...props, ...next }; return commit(); }
  function fireAnimation(finished = true, rerender = true) { const callback = animations.shift(); assert.ok(callback); callback({ finished }); if (rerender) commit(); }
  function setPurchase(fn: () => Promise<unknown>) { purchase = fn; }

  return {
    commit, update, find, invoke, text, fireAnimation, setPurchase,
    get animations() { return animations.length; },
    get purchaseCalls() { return purchaseCalls; },
    get points() { return points; },
    get setPointsCalls() { return setPointsCalls; },
    set props(value: Record<string, unknown>) { props = value; commit(); },
    unmount() { for (const effect of effects) effect?.cleanup?.(); },
  };
}

const episode = { uuid: 'episode-9', episodeNumber: 9, pricePoints: 50 };
const callbacks = () => {
  const calls: { close: number; charge: number; purchased: unknown[] } = { close: 0, charge: 0, purchased: [] };
  return { calls, onClose: () => { calls.close += 1; }, onCharge: () => { calls.charge += 1; }, onPurchased: (value: unknown) => { calls.purchased.push(value); } };
};

test('dismiss freezes popup text until the fade finishes and does not purchase', () => {
  const dialog = createDialog();
  const cb = callbacks();
  dialog.props = { episode, dramaTitle: '작품 A', ...cb };
  dialog.invoke(dialog.find('Modal'), 'onShow');
  dialog.fireAnimation();
  dialog.invoke(dialog.find('Pressable', '팝업 닫기'), 'onPress');
  dialog.invoke(dialog.find('Modal'), 'onRequestClose');
  dialog.update({ episode: null });
  assert.equal(dialog.find('Button', '구매하기').props.disabled, true);
  assert.match(dialog.text(dialog.find('Modal')), /작품 A · 9화/);
  assert.match(dialog.text(dialog.find('Modal')), /50 P/);
  assert.equal(cb.calls.close, 0);
  assert.equal(cb.calls.purchased.length, 0);
  dialog.invoke(dialog.find('Modal'), 'onDismiss');
  assert.equal(cb.calls.close, 0);
  dialog.fireAnimation();
  dialog.invoke(dialog.find('Modal'), 'onDismiss');
  assert.equal(cb.calls.close, 1);
  assert.equal(cb.calls.purchased.length, 0);
});

test('purchase navigates only after fade and platform dismissal confirmation', async () => {
  const dialog = createDialog('ios');
  const cb = callbacks();
  dialog.props = { episode, dramaTitle: '작품 A', ...cb };
  dialog.invoke(dialog.find('Modal'), 'onShow');
  dialog.fireAnimation();
  let resolvePurchase!: (value: { availablePoints: number }) => void;
  dialog.setPurchase(() => new Promise((resolve) => { resolvePurchase = resolve; }));
  dialog.invoke(dialog.find('Button', '구매하기'), 'onPress');
  dialog.invoke(dialog.find('Button', '구매하기'), 'onPress');
  assert.equal(dialog.purchaseCalls, 1);
  dialog.commit();
  await new Promise<void>((resolve) => setImmediate(resolve));
  resolvePurchase({ availablePoints: 70 });
  await new Promise<void>((resolve) => setImmediate(resolve));
  dialog.commit();
  assert.equal(dialog.points, 70);
  assert.equal(cb.calls.purchased.length, 0);
  assert.equal(dialog.find('Button', '구매 중…').props.disabled, true);
  assert.match(dialog.text(dialog.find('Modal')), /120 P/);
  assert.match(dialog.text(dialog.find('Modal')), /보유 포인트로 바로 구매할 수 있어요/);
  assert.equal(dialog.animations, 1);
  dialog.invoke(dialog.find('Modal'), 'onDismiss');
  assert.equal(cb.calls.purchased.length, 0);
  dialog.fireAnimation();
  assert.equal(cb.calls.purchased.length, 0);
  dialog.invoke(dialog.find('Modal'), 'onDismiss');
  assert.equal(cb.calls.close, 1);
  assert.deepEqual(cb.calls.purchased, [episode]);
  dialog.invoke(dialog.find('Modal'), 'onDismiss');
  assert.equal(cb.calls.purchased.length, 1);
});

test('purchase failure stays visible through dismiss and a later open uses fresh episode state', async () => {
  const dialog = createDialog();
  const cb = callbacks();
  dialog.props = { episode, dramaTitle: '작품 A', ...cb };
  dialog.invoke(dialog.find('Modal'), 'onShow');
  dialog.fireAnimation();
  dialog.setPurchase(async () => { throw new Error('offline'); });
  dialog.invoke(dialog.find('Button', '구매하기'), 'onPress');
  await new Promise<void>((resolve) => setImmediate(resolve));
  dialog.commit();
  assert.match(dialog.text(dialog.find('Modal')), /회차를 구매하지 못했어요/);
  dialog.invoke(dialog.find('Pressable', '닫기'), 'onPress');
  dialog.update({ episode: null });
  assert.match(dialog.text(dialog.find('Modal')), /회차를 구매하지 못했어요/);
  dialog.fireAnimation();
  dialog.invoke(dialog.find('Modal'), 'onDismiss');

  dialog.update({ episode: { ...episode, uuid: 'episode-10', episodeNumber: 10, pricePoints: 130 } });
  assert.equal(dialog.find('Button', '포인트 충전하기').props.label, '포인트 충전하기');
  assert.match(dialog.text(dialog.find('Modal')), /작품 A · 10화/);
  assert.doesNotMatch(dialog.text(dialog.find('Modal')), /회차를 구매하지 못했어요/);
  assert.equal(cb.calls.purchased.length, 0);
});

test('charge callback waits for Android hidden commit; stopped fade never dismisses', () => {
  const dialog = createDialog('android', 30);
  const cb = callbacks();
  dialog.props = { episode, dramaTitle: '작품 A', ...cb };
  dialog.invoke(dialog.find('Modal'), 'onShow');
  dialog.fireAnimation();
  dialog.invoke(dialog.find('Button', '포인트 충전하기'), 'onPress');
  assert.equal(cb.calls.charge, 0);
  dialog.fireAnimation();
  assert.equal(cb.calls.charge, 1);
  assert.equal(cb.calls.close, 1);

  const interrupted = createDialog('android');
  const other = callbacks();
  interrupted.props = { episode, dramaTitle: '작품 A', ...other };
  interrupted.invoke(interrupted.find('Modal'), 'onShow');
  interrupted.fireAnimation();
  interrupted.invoke(interrupted.find('Pressable', '닫기'), 'onPress');
  assert.equal(other.calls.close, 0);
  interrupted.unmount();
  interrupted.fireAnimation(true, false);
  assert.equal(other.calls.close, 0);
});
