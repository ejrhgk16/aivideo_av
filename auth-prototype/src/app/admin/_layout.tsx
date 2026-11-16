import { Redirect } from 'expo-router';

// The admin prototype is web-only; native apps return to the viewer home.
export default function AdminLayout() {
  return <Redirect href="/" />;
}
