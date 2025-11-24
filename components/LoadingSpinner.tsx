import React from 'react';
import { Search, Heart, Hourglass, Compass, Loader2 } from 'lucide-react';
import { Genre } from '../types';

interface LoadingSpinnerProps {
  genre?: Genre | null;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ genre }) => {
  const getIcon = () => {
    switch (genre) {
      case Genre.DETECTIVE:
        return (
          <div className="relative">
            <Search 
              className="w-12 h-12 text-blue-600 animate-pulse" 
              style={{ animationDuration: '3s' }}
            />
          </div>
        );
      case Genre.ROMANCE:
        return (
          <div className="relative">
            <Heart 
              className="w-12 h-12 text-blue-600 animate-bounce" 
              fill="currentColor" 
              style={{ animationDuration: '2s' }}
            />
          </div>
        );
      case Genre.HISTORICAL:
        return (
          <div className="relative">
            <Hourglass 
              className="w-12 h-12 text-blue-600 animate-spin" 
              style={{ animationDuration: '4s' }}
            />
          </div>
        );
      case Genre.ADVENTURE:
        return (
          <div className="relative">
            <Compass 
              className="w-12 h-12 text-blue-600 animate-spin" 
              style={{ animationDuration: '4s' }}
            />
          </div>
        );
      default:
        return (
          <div className="relative">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
          </div>
        );
    }
  };

  return (
    <div className="flex items-center justify-center p-4">
      {getIcon()}
    </div>
  );
};