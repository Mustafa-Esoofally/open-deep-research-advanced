'use client';

import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity } from './types';
import { Clock, Search, FileText, Brain, BookOpen, Lightbulb } from 'lucide-react';

interface ActivityPanelProps {
  activities: Activity[];
  isLoading?: boolean;
}

export function ActivityPanel({ activities, isLoading = false }: ActivityPanelProps) {
  if (activities.length === 0 && !isLoading) {
    return null;
  }

  // Get icon based on activity type
  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'search':
        return <Search className="h-4 w-4 text-blue-500" />;
      case 'extract':
        return <FileText className="h-4 w-4 text-green-500" />;
      case 'analyze':
        return <BookOpen className="h-4 w-4 text-purple-500" />;
      case 'reasoning':
        return <Brain className="h-4 w-4 text-amber-500" />;
      case 'synthesis':
        return <Lightbulb className="h-4 w-4 text-rose-500" />;
      case 'thought':
        return <Lightbulb className="h-4 w-4 text-blue-400" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  // Get color based on activity status
  const getStatusColor = (status: Activity['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500';
      case 'complete':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Format the timestamp
  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (e) {
      return 'Unknown time';
    }
  };

  return (
    <div className="w-full border-l border-border bg-card flex flex-col h-full max-h-full">
      <div className="p-4 border-b border-border flex justify-between items-center">
        <h3 className="font-semibold">Activity Log</h3>
        {isLoading && (
          <div className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full animate-pulse">
            Processing...
          </div>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        <AnimatePresence initial={false}>
          {activities.length > 0 ? (
            <div className="space-y-4">
              {activities.map((activity) => (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-start gap-3 text-sm"
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {getActivityIcon(activity.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="capitalize text-xs text-muted-foreground">
                        {activity.type}
                      </div>
                      <div className={`h-2 w-2 rounded-full ${getStatusColor(activity.status)}`} />
                    </div>
                    
                    <p className="text-sm text-foreground break-words whitespace-pre-wrap">
                      {activity.message}
                    </p>
                    
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTimestamp(activity.timestamp)}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              {isLoading ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                  <p>Waiting for activities...</p>
                </div>
              ) : (
                <p>No activities yet</p>
              )}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
} 