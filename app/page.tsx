'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

export default function Home() {
  const [apiResponse, setApiResponse] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`http://${process.env.NEXT_PUBLIC_BACKEND_URL!}`);
        const data = await response.text();
        setApiResponse(data);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      <div className="container mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-center mb-2 animate-fade-in">Fargate via ECS</h1>
        <h2 className="text-2xl font-semibold text-center mb-6 text-[#FF9900]">A Simple Containerized Node.js Application</h2>
        <div className="flex justify-center mb-12">
          <Image src="/architecture.png" alt="Architecture" width={600} height={200} className="rounded-lg shadow-lg" />
        </div>
        <p className="text-center">{apiResponse}</p>
      </div>
    </main>
  );
}
