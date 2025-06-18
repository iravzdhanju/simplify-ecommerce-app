/**
 * Example: Using Native Clerk + Supabase Integration
 *
 * This example shows how simple it is to use the native integration
 * compared to the old JWT template approach.
 */

'use client';

import { useEffect, useState } from 'react';
import { useSupabaseClient } from '@/lib/supabase/client';
import { useUser } from '@clerk/nextjs';

export default function TasksExample() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [newTask, setNewTask] = useState('');
  const [loading, setLoading] = useState(true);

  const supabase = useSupabaseClient();
  const { user } = useUser();

  // Load tasks for the authenticated user
  useEffect(() => {
    if (!user) return;

    async function loadTasks() {
      setLoading(true);

      // RLS automatically filters by user - no manual filtering needed!
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading tasks:', error);
      } else {
        setTasks(data || []);
      }

      setLoading(false);
    }

    loadTasks();
  }, [user, supabase]);

  // Add a new task
  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTask.trim()) return;

    const { error } = await supabase.from('tasks').insert({
      name: newTask
      // user_id will be automatically set by RLS policies
      // or you can explicitly set it to auth.jwt() ->> 'sub'
    });

    if (error) {
      console.error('Error adding task:', error);
    } else {
      setNewTask('');
      // Reload tasks
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });
      setTasks(data || []);
    }
  }

  // Delete a task
  async function handleDeleteTask(taskId: number) {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);

    if (error) {
      console.error('Error deleting task:', error);
    } else {
      setTasks(tasks.filter((task) => task.id !== taskId));
    }
  }

  if (!user) {
    return <div>Please sign in to view your tasks.</div>;
  }

  if (loading) {
    return <div>Loading tasks...</div>;
  }

  return (
    <div className='space-y-4'>
      <h2 className='text-2xl font-bold'>My Tasks</h2>

      {/* Add new task form */}
      <form onSubmit={handleAddTask} className='flex gap-2'>
        <input
          type='text'
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          placeholder='Enter a new task...'
          className='flex-1 rounded-md border px-3 py-2'
        />
        <button
          type='submit'
          className='rounded-md bg-blue-500 px-4 py-2 text-white hover:bg-blue-600'
        >
          Add Task
        </button>
      </form>

      {/* Tasks list */}
      <div className='space-y-2'>
        {tasks.length === 0 ? (
          <p className='text-gray-500'>No tasks yet. Add one above!</p>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className='flex items-center justify-between rounded-md border p-3'
            >
              <span>{task.name}</span>
              <button
                onClick={() => handleDeleteTask(task.id)}
                className='rounded-md bg-red-500 px-3 py-1 text-white hover:bg-red-600'
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>

      <div className='text-sm text-gray-600'>
        <p>
          <strong>How it works:</strong>
        </p>
        <ul className='list-inside list-disc space-y-1'>
          <li>Clerk handles authentication automatically</li>
          <li>Supabase RLS policies filter data by user automatically</li>
          <li>No manual token management or user ID filtering needed</li>
          <li>
            Your queries work exactly like they would with any auth system
          </li>
        </ul>
      </div>
    </div>
  );
}

/**
 * Server-side example (for API routes or server components):
 */

/*
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@/lib/supabase/server'

export async function getUserTasks() {
  const { userId } = await auth()
  
  if (!userId) {
    throw new Error('Not authenticated')
  }

  const supabase = await createClient()
  
  // RLS automatically filters by user
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return data
}
*/
