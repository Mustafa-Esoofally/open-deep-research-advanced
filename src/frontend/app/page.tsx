"use client"

import { Chat } from '@/components/chat';
import { Toaster } from 'sonner';

export default function Home() {
  return (
    <>
      <Chat />
      <Toaster />
    </>
  );
}
