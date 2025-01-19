'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

interface FargateResponse {
  message: string;
  metadata: {
    DockerId: string;
    Name: string;
    DockerName: string;
    Image: string;
    ImageID: string;
    DesiredStatus: string;
    KnownStatus: string;
    CreatedAt: string;
    StartedAt: string;
    Type: string;
  };
}

const getFormattedDate = (date: string) => new Date(date).toLocaleString('en-US', { timeZone: 'UTC' });

export default function Home() {
  const [apiResponse, setApiResponse] = useState<FargateResponse | undefined>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`http://${process.env.NEXT_PUBLIC_BACKEND_URL!}`);
        const data: FargateResponse = await response.json();
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
        <div className="text-center">
          <p className="text-xl font-semibold mb-4">{apiResponse?.message}</p>
          {apiResponse?.metadata && (
            <div className="bg-gray-700 p-6 rounded-lg shadow-md">
              <p className="text-lg mb-2">
                <span className="font-semibold">Docker ID:</span> {apiResponse.metadata.DockerId}
              </p>
              <p className="text-lg mb-2">
                <span className="font-semibold">Name:</span> {apiResponse.metadata.Name}
              </p>
              <p className="text-lg mb-2">
                <span className="font-semibold">Docker Name:</span> {apiResponse.metadata.DockerName}
              </p>
              <p className="text-lg mb-2">
                <span className="font-semibold">Image:</span> {apiResponse.metadata.Image}
              </p>
              <p className="text-lg mb-2">
                <span className="font-semibold">Image ID:</span> {apiResponse.metadata.ImageID.slice(0, 12)}
              </p>
              <p className="text-lg mb-2">
                <span className="font-semibold">Desired Status:</span> {apiResponse.metadata.DesiredStatus}
              </p>
              <p className="text-lg mb-2">
                <span className="font-semibold">Known Status:</span> {apiResponse.metadata.KnownStatus}
              </p>
              <p className="text-lg mb-2">
                <span className="font-semibold">Created At:</span> {getFormattedDate(apiResponse.metadata.CreatedAt)}
              </p>
              <p className="text-lg">
                <span className="font-semibold">Started At:</span> {getFormattedDate(apiResponse.metadata.StartedAt)}
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
