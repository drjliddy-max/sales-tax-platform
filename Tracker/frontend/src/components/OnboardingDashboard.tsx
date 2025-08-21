import React, { useState, useEffect } from 'react';
import { 
  Play, 
  CheckCircle, 
  Clock, 
  Star, 
  Award, 
  Users, 
  Zap,
  BookOpen,
  TrendingUp,
  Settings,
  Filter
} from 'lucide-react';
import { Tutorial, OnboardingProgress, POSOnboardingContext } from '@/types/onboarding';
import { onboardingService } from '@/services/onboarding';
import TutorialOverlay from './TutorialOverlay';

interface OnboardingDashboardProps {
  className?: string;
  onTutorialStart?: (tutorialId: string) => void;
}

export const OnboardingDashboard: React.FC<OnboardingDashboardProps> = ({
  className = '',
  onTutorialStart
}) => {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeTutorial, setActiveTutorial] = useState<Tutorial | null>(null);
  const [showTutorialOverlay, setShowTutorialOverlay] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [context, setContext] = useState<POSOnboardingContext>({});

  const categories = [
    { id: 'all', name: 'All Tutorials', icon: BookOpen },
    { id: 'pos_integration', name: 'POS Integration', icon: Settings },
    { id: 'dashboard', name: 'Dashboard', icon: TrendingUp },
    { id: 'reports', name: 'Reports & Analytics', icon: Star },
    { id: 'general', name: 'General', icon: Users }
  ];

  useEffect(() => {
    loadData();
  }, [selectedCategory]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [tutorialsData, progressData] = await Promise.all([
        onboardingService.getTutorials(selectedCategory === 'all' ? undefined : selectedCategory),
        onboardingService.getProgress()
      ]);
      
      setTutorials(tutorialsData);
      setProgress(progressData);
    } catch (error) {
      console.error('Failed to load onboarding data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartTutorial = async (tutorial: Tutorial) => {
    try {
      await onboardingService.startTutorial(tutorial.id);
      setActiveTutorial(tutorial);
      setShowTutorialOverlay(true);
      onTutorialStart?.(tutorial.id);
    } catch (error) {
      console.error('Failed to start tutorial:', error);
    }
  };

  const handleTutorialComplete = async () => {
    if (activeTutorial) {
      try {
        await onboardingService.completeTutorial(activeTutorial.id);
        setShowTutorialOverlay(false);
        setActiveTutorial(null);
        await loadData(); // Refresh progress
      } catch (error) {
        console.error('Failed to complete tutorial:', error);
      }
    }
  };

  const handleTutorialSkip = async () => {
    if (activeTutorial) {
      try {
        await onboardingService.skipTutorial(activeTutorial.id);
        setShowTutorialOverlay(false);
        setActiveTutorial(null);
        await loadData(); // Refresh progress
      } catch (error) {
        console.error('Failed to skip tutorial:', error);
      }
    }
  };

  const handleTutorialClose = () => {
    setShowTutorialOverlay(false);
    setActiveTutorial(null);
  };

  const getTutorialStatus = (tutorialId: string) => {
    if (!progress) return 'available';
    if (progress.completedTutorials.includes(tutorialId)) return 'completed';
    if (progress.skippedTutorials.includes(tutorialId)) return 'skipped';
    if (progress.currentTutorial?.tutorialId === tutorialId) return 'in_progress';
    return 'available';
  };

  const getDifficultyColor = (difficulty: Tutorial['difficulty']) => {
    switch (difficulty) {
      case 'beginner': return 'text-green-600 bg-green-100';
      case 'intermediate': return 'text-yellow-600 bg-yellow-100';
      case 'advanced': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'in_progress': return 'text-blue-600 bg-blue-100';
      case 'skipped': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-white border border-gray-300';
    }
  };

  const filteredTutorials = tutorials.filter(tutorial => {
    if (selectedCategory === 'all') return true;
    return tutorial.category === selectedCategory;
  });

  const completedCount = progress?.completedTutorials.length || 0;
  const totalCount = tutorials.length;
  const progressPercentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  if (isLoading) {
    return (
      <div className={`${className} animate-pulse`}>
        <div className="space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-64 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Getting Started</h1>
            <p className="text-gray-600 mt-1">
              Learn how to make the most of your sales tax tracking system
            </p>
          </div>
          
          {progress && (
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600">{completedCount}/{totalCount}</div>
              <div className="text-sm text-gray-600">Tutorials Completed</div>
            </div>
          )}
        </div>

        {/* Progress Overview */}
        {progress && (
          <div className="bg-white rounded-lg border p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Your Progress</h3>
              <span className="text-sm text-gray-600">{Math.round(progressPercentage)}% Complete</span>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
              <div
                className="bg-blue-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-green-600">{progress.completedTutorials.length}</div>
                <div className="text-sm text-gray-600">Completed</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {progress.currentTutorial ? 1 : 0}
                </div>
                <div className="text-sm text-gray-600">In Progress</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-600">
                  {totalCount - progress.completedTutorials.length - (progress.currentTutorial ? 1 : 0)}
                </div>
                <div className="text-sm text-gray-600">Remaining</div>
              </div>
            </div>
          </div>
        )}

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 mb-6">
          {categories.map(category => {
            const Icon = category.icon;
            const isActive = selectedCategory === category.id;
            
            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4 mr-2" />
                {category.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tutorial Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTutorials.map(tutorial => {
          const status = getTutorialStatus(tutorial.id);
          const Icon = status === 'completed' ? CheckCircle : Play;
          
          return (
            <div
              key={tutorial.id}
              className="bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors overflow-hidden"
            >
              {/* Header */}
              <div className="p-6 pb-4">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
                    {tutorial.title}
                  </h3>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                    {status === 'completed' ? 'Done' : status === 'in_progress' ? 'Active' : status === 'skipped' ? 'Skipped' : 'New'}
                  </div>
                </div>
                
                <p className="text-gray-600 text-sm line-clamp-3 mb-4">
                  {tutorial.description}
                </p>

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center text-gray-500">
                      <Clock className="w-4 h-4 mr-1" />
                      {tutorial.estimatedDuration}m
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(tutorial.difficulty)}`}>
                      {tutorial.difficulty}
                    </div>
                  </div>
                  
                  {tutorial.completionReward && (
                    <div className="flex items-center text-yellow-600">
                      <Award className="w-4 h-4 mr-1" />
                      <span className="text-xs">Reward</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                <button
                  onClick={() => handleStartTutorial(tutorial)}
                  disabled={status === 'completed'}
                  className={`w-full flex items-center justify-center px-4 py-2 rounded-lg font-medium transition-colors ${
                    status === 'completed'
                      ? 'bg-green-100 text-green-700 cursor-not-allowed'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {status === 'completed' ? 'Completed' : status === 'in_progress' ? 'Continue' : 'Start Tutorial'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredTutorials.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Tutorials Available</h3>
          <p className="text-gray-600">
            {selectedCategory === 'all' 
              ? 'No tutorials are currently available.'
              : `No tutorials found in the ${categories.find(c => c.id === selectedCategory)?.name} category.`
            }
          </p>
        </div>
      )}

      {/* Tutorial Overlay */}
      {activeTutorial && (
        <TutorialOverlay
          tutorial={activeTutorial}
          isVisible={showTutorialOverlay}
          onComplete={handleTutorialComplete}
          onSkip={handleTutorialSkip}
          onClose={handleTutorialClose}
          currentStepIndex={progress?.currentTutorial?.currentStepIndex || 0}
          onStepChange={(stepIndex) => {
            if (activeTutorial) {
              onboardingService.updateProgress(activeTutorial.id, stepIndex);
            }
          }}
        />
      )}
    </div>
  );
};

export default OnboardingDashboard;
