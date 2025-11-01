import AfrodexStaking from '../components/AfrodexStaking';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <h1 className="text-4xl font-bold text-blue-600 mb-6">Welcome to Afrodex</h1>
      <AfrodexStaking />
    </div>
  );
}
