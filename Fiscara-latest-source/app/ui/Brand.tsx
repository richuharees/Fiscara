import Link from "next/link";

export default function Brand() {
  return (
    <Link href="/" className="brand fiscara-brand" aria-label="Fiscara home">
      <span className="fiscara-fi" lang="ml">ഫി</span>
      <span className="fiscara-scara">scara</span>
    </Link>
  );
}
