export default function ReferralLinkBox({ wallet }) {
  const link = `${process.env.NEXT_PUBLIC_SITE_URL}/?ref=${wallet}`;

  return (
    <div className="p-4 bg-gray-900 border border-gray-700 rounded-xl">
      <h3 className="text-gray-300 mb-2">Your Referral Link</h3>

      <div className="flex items-center">
        <input
          className="flex-1 bg-black border border-gray-700 p-2 rounded text-orange-400"
          value={link}
          readOnly
        />
        <button
          className="ml-3 px-3 py-2 bg-orange-600 rounded text-white"
          onClick={() => navigator.clipboard.writeText(link)}
        >
          Copy
        </button>
      </div>
    </div>
  );
}
