import React from 'react';
import { Home, Compass, PlusSquare, MessageCircle, User } from 'lucide-react';

export const Sidebar: React.FC = () => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-[500px] mx-auto bg-black/80 backdrop-blur-md border-t border-gray-800 z-50 flex justify-around items-center h-14 pb-safe">
      <button className="flex flex-col items-center justify-center w-full h-full text-white">
        <Home size={24} className="mb-1" />
        <span className="text-[10px] font-semibold">Home</span>
      </button>
      <button className="flex flex-col items-center justify-center w-full h-full text-gray-500 hover:text-white transition">
        <Compass size={24} className="mb-1" />
        <span className="text-[10px] font-semibold">Discover</span>
      </button>
      <button className="flex flex-col items-center justify-center w-full h-full">
        <div className="bg-gradient-to-r from-blue-400 via-white to-pink-500 rounded-lg p-[2px]">
          <div className="bg-white text-black rounded-md px-3 py-1">
            <PlusSquare size={20} className="fill-black text-white" />
          </div>
        </div>
      </button>
      <button className="flex flex-col items-center justify-center w-full h-full text-gray-500 hover:text-white transition">
        <MessageCircle size={24} className="mb-1" />
        <span className="text-[10px] font-semibold">Inbox</span>
      </button>
      <button className="flex flex-col items-center justify-center w-full h-full text-gray-500 hover:text-white transition">
        <User size={24} className="mb-1" />
        <span className="text-[10px] font-semibold">Profile</span>
      </button>
    </nav>
  );
};
