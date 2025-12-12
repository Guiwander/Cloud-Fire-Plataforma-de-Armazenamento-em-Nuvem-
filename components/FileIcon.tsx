import React from 'react';
import { FileType } from '../types';
import { FileText, Image as ImageIcon, Music, Video, Archive, FileQuestion, Folder } from 'lucide-react';

interface FileIconProps {
  type: FileType | 'FOLDER';
  className?: string;
}

export const FileIcon: React.FC<FileIconProps> = ({ type, className = "w-6 h-6" }) => {
  switch (type) {
    case 'FOLDER':
      return <Folder className={`${className} text-yellow-500 fill-yellow-500`} />;
    case FileType.IMAGE:
      return <ImageIcon className={`${className} text-purple-500`} />;
    case FileType.VIDEO:
      return <Video className={`${className} text-red-500`} />;
    case FileType.AUDIO:
      return <Music className={`${className} text-pink-500`} />;
    case FileType.ARCHIVE:
      return <Archive className={`${className} text-orange-500`} />;
    case FileType.DOCUMENT:
      return <FileText className={`${className} text-blue-500`} />;
    default:
      return <FileQuestion className={`${className} text-gray-400`} />;
  }
};