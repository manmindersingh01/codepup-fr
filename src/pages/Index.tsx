// Fixed Index.tsx with proper design choice parsing and color rendering

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import axios from "axios";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  useUser,
  UserButton,
} from "@clerk/clerk-react";
import ExpandableDesignPreview from './design-preview';
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router-dom";
import {
  ExternalLink,
  Calendar,
  Code2,
  Trash2,
  MessageSquare,
  Clock,
  AlertCircle,
  Database,
  Send,
  CheckCircle,
  ArrowRight,
  Settings,
  Eye,
  Loader2,
  Sparkles,
  Palette,
  Upload,
  Image as ImageIcon,
  RefreshCw,
} from "lucide-react";
import SupabaseConfigForm from "./form";

// --- Updated Types to match API response ---
interface Project {
  id: number;
  name: string;
  description?: string;
  deploymentUrl?: string;
  createdAt: string;
  updatedAt?: string;
  projectType?: string;
  status?: string;
  messageCount?: number;
}

interface DbUser {
  id: number;
  clerkId: string;
  email: string;
  name: string;
  phoneNumber: string | null;
  profileImage?: string;
}

interface SupabaseConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseToken: string;
  databaseUrl: string;
}

// Updated to match API response structure
interface DesignChoices {
  businessType?: string;
  businessName?: string;
  vibe?: string;
  colorScheme?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    text?: string;
  };
  // API response fields
  recommendedColors?: string[];
  allColorOptions?: string[];
  colorExplanation?: string;
  style?: string;
  features?: string[];
  layout?: string;
  recommendedLayout?: string;
  recommendedLayoutExplanation?: string;
  layoutStyles?: string[];
  differentLayouts?: string[];
  differentSections?: string[];
  components?: string[];
}

interface WorkflowStep {
  step: string;
  designChoices?: DesignChoices;
  message: string;
  readyToGenerate?: boolean;
  needsMoreInfo?: boolean;
  question?: string;
  explanation?: string;
}

interface WorkflowMessage {
  id: string;
  content: string;
  type: "user" | "assistant";
  timestamp: Date;
  step?: string;
  isLoading?: boolean;
  designChoices?: DesignChoices;
}

// --- Constants ---
const BASE_URL = import.meta.env.VITE_BASE_URL;

// Helper function to extract colors from design choices
const extractColorsFromDesignChoices = (designChoices: DesignChoices) => {
  console.log('🎨 Extracting colors from designChoices:', designChoices);
  
  // Try to get colors from different possible sources
  const colors = {
    primary: designChoices.colorScheme?.primary,
    secondary: designChoices.colorScheme?.secondary,
    accent: designChoices.colorScheme?.accent,
    background: designChoices.colorScheme?.background,
    text: designChoices.colorScheme?.text,
  };

  // If colorScheme is empty, try to use recommendedColors
  if (designChoices.recommendedColors && designChoices.recommendedColors.length > 0) {
    console.log('🎨 Using recommendedColors:', designChoices.recommendedColors);
    colors.primary = colors.primary || designChoices.recommendedColors[0];
    colors.secondary = colors.secondary || designChoices.recommendedColors[1];
    colors.accent = colors.accent || designChoices.recommendedColors[2];
  }

  // If still no colors, try allColorOptions
  if (!colors.primary && designChoices.allColorOptions && designChoices.allColorOptions.length > 0) {
    console.log('🎨 Using allColorOptions:', designChoices.allColorOptions);
    colors.primary = designChoices.allColorOptions[0];
    colors.secondary = designChoices.allColorOptions[1];
    colors.accent = designChoices.allColorOptions[2];
  }

  console.log('🎨 Extracted colors:', colors);
  return colors;
};

// --- Memoized Components ---
const ColorPalette = React.memo(({ colors }: { colors: DesignChoices['colorScheme'] }) => {
  if (!colors) return null;

  return (
    <div className="flex items-center gap-2 p-3 bg-neutral-800/30 rounded-lg border border-neutral-700/50">
      <Palette className="w-4 h-4 text-neutral-400" />
      <span className="text-xs text-neutral-400 font-medium">Colors:</span>
      <div className="flex gap-1">
        {colors.primary && (
          <div 
            className="w-6 h-6 rounded-full border-2 border-white/20"
            style={{ backgroundColor: colors.primary }}
            title={`Primary: ${colors.primary}`}
          />
        )}
        {colors.secondary && (
          <div 
            className="w-6 h-6 rounded-full border-2 border-white/20"
            style={{ backgroundColor: colors.secondary }}
            title={`Secondary: ${colors.secondary}`}
          />
        )}
        {colors.accent && (
          <div 
            className="w-6 h-6 rounded-full border-2 border-white/20"
            style={{ backgroundColor: colors.accent }}
            title={`Accent: ${colors.accent}`}
          />
        )}
      </div>
    </div>
  );
});

ColorPalette.displayName = "ColorPalette";

const DesignPreview = React.memo(({ designChoices }: { designChoices: DesignChoices }) => {
  console.log('🖼️ DesignPreview received designChoices:', designChoices);
  
  // Extract colors using the helper function
  const extractedColors = extractColorsFromDesignChoices(designChoices);
  
  const primaryColor = extractedColors.primary || '#3B82F6';
  const secondaryColor = extractedColors.secondary || '#10B981';
  const accentColor = extractedColors.accent || '#F59E0B';

  console.log('🖼️ DesignPreview using colors:', {
    primary: primaryColor,
    secondary: secondaryColor,
    accent: accentColor
  });

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-4 bg-gradient-to-br from-neutral-900/50 to-neutral-800/50 rounded-xl border border-neutral-700/50 backdrop-blur-sm"
    >
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-yellow-400" />
        <h3 className="text-sm font-medium text-white">Design Preview</h3>
      </div>
      
      {/* Mock UI Preview */}
      <div className="relative w-full h-32 bg-white rounded-lg overflow-hidden shadow-lg">
        {/* Header */}
        <div 
          className="h-8 flex items-center px-3"
          style={{ backgroundColor: primaryColor }}
        >
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-white/80 rounded-full"></div>
            <div className="w-2 h-2 bg-white/80 rounded-full"></div>
            <div className="w-2 h-2 bg-white/80 rounded-full"></div>
          </div>
        </div>
        
        {/* Content Area */}
        <div className="p-3 space-y-2">
          <div 
            className="h-3 rounded"
            style={{ backgroundColor: secondaryColor, width: '60%' }}
          ></div>
          <div className="h-2 bg-gray-200 rounded" style={{ width: '80%' }}></div>
          <div className="h-2 bg-gray-200 rounded" style={{ width: '40%' }}></div>
          
          {/* Accent elements */}
          <div className="flex gap-2 mt-3">
            <div 
              className="w-8 h-4 rounded"
              style={{ backgroundColor: accentColor }}
            ></div>
            <div 
              className="w-6 h-4 rounded"
              style={{ backgroundColor: primaryColor, opacity: 0.7 }}
            ></div>
          </div>
        </div>
      </div>

      {/* Design Details */}
      <div className="mt-3 space-y-2">
        {(designChoices.businessType || designChoices.businessName) && (
          <div className="text-xs text-neutral-300">
            <span className="text-neutral-500">Business:</span> {designChoices.businessName || designChoices.businessType}
          </div>
        )}
        {(designChoices.style || designChoices.recommendedLayout) && (
          <div className="text-xs text-neutral-300">
            <span className="text-neutral-500">Style:</span> {designChoices.recommendedLayout || designChoices.style}
          </div>
        )}
        {designChoices.vibe && (
          <div className="text-xs text-neutral-300">
            <span className="text-neutral-500">Vibe:</span> {designChoices.vibe}
          </div>
        )}
        <ColorPalette colors={extractedColors} />
        {(designChoices.features || designChoices.differentSections) && (
          <div className="text-xs text-neutral-300">
            <span className="text-neutral-500">Features:</span> {
              (designChoices.differentSections || designChoices.features || [])
                .slice(0, 2)
                .join(', ')
            }
            {(designChoices.differentSections || designChoices.features || []).length > 2 && 
              ` +${(designChoices.differentSections || designChoices.features || []).length - 2} more`
            }
          </div>
        )}
      </div>
    </motion.div>
  );
});

DesignPreview.displayName = "DesignPreview";

const ProjectCard = React.memo(
  ({
    project,
    onProjectClick,
    onDeleteProject,
    onContinueChat,
    onPreviewDesign,
  }: {
    project: Project;
    onProjectClick: (project: Project) => void;
    onDeleteProject: (projectId: number, e: React.MouseEvent<HTMLButtonElement>) => void;
    onContinueChat: (project: Project, e: React.MouseEvent<HTMLButtonElement>) => void;
    onPreviewDesign?: (designChoices: DesignChoices) => void;
  }) => {
    // Enhanced design choices parsing with debug logging
    const designChoices = useMemo(() => {
      try {
        if (project.description) {
          console.log('🔍 ProjectCard - Raw project.description:', project.description);
          
          // Try to parse as JSON first
          try {
            const parsed = JSON.parse(project.description);
            console.log('🔍 ProjectCard - Parsed JSON:', parsed);
            
            // Check different possible structures
            let choices = null;
            
            if (parsed.structure?.designChoices) {
              choices = parsed.structure.designChoices;
              console.log('🔍 ProjectCard - Found in structure.designChoices:', choices);
            } else if (parsed.designChoices) {
              choices = parsed.designChoices;
              console.log('🔍 ProjectCard - Found in designChoices:', choices);
            } else if (parsed.businessType || parsed.recommendedColors) {
              // Direct structure match
              choices = parsed;
              console.log('🔍 ProjectCard - Using direct structure:', choices);
            }
            
            if (choices) {
              console.log('🔍 ProjectCard - Final design choices:', choices);
              return choices;
            }
          } catch (parseError) {
            console.log('🔍 ProjectCard - JSON parse failed, trying as text');
          }
          
          // If JSON parsing fails, try to extract from text
          if (project.description.includes('businessType') || project.description.includes('recommendedColors')) {
            console.log('🔍 ProjectCard - Found design keywords in description text');
            // Could add more sophisticated text parsing here if needed
          }
        }
      } catch (error) {
        console.error('🔍 ProjectCard - Error parsing design choices:', error);
      }
      return null;
    }, [project.description]);

    // Extract colors for the card display
    const cardColors = useMemo(() => {
      if (designChoices) {
        return extractColorsFromDesignChoices(designChoices);
      }
      return null;
    }, [designChoices]);

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.02, y: -5 }}
        className="bg-gradient-to-br from-neutral-900/80 to-neutral-800/80 backdrop-blur-sm border border-neutral-700/50 rounded-xl p-4 cursor-pointer group relative overflow-hidden"
        onClick={() => onProjectClick(project)}
      >
        {/* Gradient overlay based on design colors */}
        {cardColors?.primary && (
          <div 
            className="absolute inset-0 opacity-5 group-hover:opacity-10 transition-opacity duration-300"
            style={{ 
              background: `linear-gradient(135deg, ${cardColors.primary}20, ${cardColors.secondary || cardColors.primary}10)`
            }}
          />
        )}

        {/* Thumbnail */}
        <div className="relative w-full h-32 bg-neutral-800 rounded-lg mb-3 overflow-hidden">
          {project.deploymentUrl ? (
            <iframe
              src={project.deploymentUrl}
              className="w-full h-full scale-50 origin-top-left transform pointer-events-none"
              title={`${project.name} preview`}
              style={{ width: "200%", height: "200%" }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Code2 className="w-8 h-8 text-neutral-600" />
            </div>
          )}

          {/* Status Badge */}
          {project.status && (
            <div className="absolute top-2 left-2">
              <span
                className={`px-2 py-1 text-xs rounded-full font-medium backdrop-blur-sm ${
                  project.status === "ready"
                    ? "bg-green-500/20 text-green-400 border border-green-500/30"
                    : project.status === "building"
                    ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                    : project.status === "error"
                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                    : "bg-neutral-500/20 text-neutral-400 border border-neutral-500/30"
                }`}
              >
                {project.status}
              </span>
            </div>
          )}

          {/* Color indicator */}
          {cardColors && (
            <div className="absolute top-2 right-2 flex gap-1">
              {cardColors.primary && (
                <div 
                  className="w-3 h-3 rounded-full border border-white/50"
                  style={{ backgroundColor: cardColors.primary }}
                />
              )}
              {cardColors.secondary && (
                <div 
                  className="w-3 h-3 rounded-full border border-white/50"
                  style={{ backgroundColor: cardColors.secondary }}
                />
              )}
              {cardColors.accent && (
                <div 
                  className="w-3 h-3 rounded-full border border-white/50"
                  style={{ backgroundColor: cardColors.accent }}
                />
              )}
            </div>
          )}

          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
            {designChoices && onPreviewDesign && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPreviewDesign(designChoices);
                }}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <Eye className="w-4 h-4" />
                Preview Design
              </button>
            )}
            <span className="text-white text-sm font-medium">or Click to Open</span>
          </div>
        </div>

        {/* Project Info */}
        <div className="relative space-y-2">
          <div className="flex items-start justify-between">
            <h3 className="text-white font-medium text-sm truncate flex-1">
              {project.name}
            </h3>
            <button
              onClick={(e) => onDeleteProject(project.id, e)}
              className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 hover:bg-red-500/20 rounded"
            >
              <Trash2 className="w-4 h-4 text-red-400" />
            </button>
          </div>

          {/* Design info preview */}
          {designChoices && (
            <div className="text-xs space-y-1">
              {designChoices.businessName && (
                <div className="text-neutral-300">
                  <span className="text-neutral-500">Business:</span> {designChoices.businessName}
                </div>
              )}
              {designChoices.recommendedLayout && (
                <div className="text-neutral-300">
                  <span className="text-neutral-500">Layout:</span> {designChoices.recommendedLayout}
                </div>
              )}
              {cardColors && (
                <div className="flex items-center gap-1">
                  <span className="text-neutral-500">Colors:</span>
                  <div className="flex gap-1">
                    {cardColors.primary && (
                      <div 
                        className="w-3 h-3 rounded-full border border-white/20"
                        style={{ backgroundColor: cardColors.primary }}
                      />
                    )}
                    {cardColors.secondary && (
                      <div 
                        className="w-3 h-3 rounded-full border border-white/20"
                        style={{ backgroundColor: cardColors.secondary }}
                      />
                    )}
                    {cardColors.accent && (
                      <div 
                        className="w-3 h-3 rounded-full border border-white/20"
                        style={{ backgroundColor: cardColors.accent }}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Message Count */}
          {project.messageCount && project.messageCount > 0 && (
            <div className="flex items-center gap-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <MessageSquare className="w-3 h-3 text-blue-400" />
              <span className="text-xs text-blue-400">
                {project.messageCount} messages
              </span>
              <button
                onClick={(e) => onContinueChat(project, e)}
                className="text-xs text-blue-400 hover:text-blue-300 underline ml-auto"
              >
                Continue Chat
              </button>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-neutral-500">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>{new Date(project.createdAt).toLocaleDateString()}</span>
            </div>

            <div className="flex items-center gap-3">
              {project.updatedAt &&
                new Date(project.updatedAt).getTime() !==
                  new Date(project.createdAt).getTime() && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>
                      {new Date(project.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                )}

              {project.deploymentUrl && (
                <div className="flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" />
                  <span>Live</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  }
);

ProjectCard.displayName = "ProjectCard";

// Feedback Input Component
const FeedbackInput = React.memo(({ 
  onSubmit, 
  isLoading 
}: { 
  onSubmit: (feedback: string) => void;
  isLoading: boolean;
}) => {
  const [feedback, setFeedback] = useState("");

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (feedback.trim() && !isLoading) {
      onSubmit(feedback.trim());
      setFeedback("");
    }
  }, [feedback, isLoading, onSubmit]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  }, [handleSubmit]);

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder="Share your feedback or ask questions..."
        className="flex-1 px-3 py-2 bg-neutral-800/50 border border-neutral-600/50 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
        disabled={isLoading}
      />
      <button
        type="submit"
        disabled={!feedback.trim() || isLoading}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors duration-200 flex items-center gap-2"
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Send className="w-4 h-4" />
        )}
      </button>
    </form>
  );
});

FeedbackInput.displayName = "FeedbackInput";

// --- Main Component ---
const Index = () => {
  const [prompt, setPrompt] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState<boolean>(false);
  const [dbUser, setDbUser] = useState<DbUser | null>(null);
  const [showDesignPreview, setShowDesignPreview] = useState(false);
  const [selectedDesignForPreview, setSelectedDesignForPreview] = useState<DesignChoices | null>(null);
  
  // Workflow states
  const [workflowActive, setWorkflowActive] = useState<boolean>(false);
  const [workflowMessages, setWorkflowMessages] = useState<WorkflowMessage[]>([]);
  const [currentStep, setCurrentStep] = useState<string>("analyze");
  const [designChoices, setDesignChoices] = useState<DesignChoices | null>(null);
  const [readyToGenerate, setReadyToGenerate] = useState<boolean>(false);
  const [isProcessingFeedback, setIsProcessingFeedback] = useState<boolean>(false);
  const [currentProjectId, setCurrentProjectId] = useState<number | null>(null);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);

  // Supabase configuration state
  const [showSupabaseConfig, setShowSupabaseConfig] = useState(false);
  const [supabaseConfig, setSupabaseConfig] = useState<SupabaseConfig | null>(null);
  const [isConfigValid, setIsConfigValid] = useState(false);

  const navigate = useNavigate();
  const { user: clerkUser, isLoaded } = useUser();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [workflowMessages, scrollToBottom]);

  // Load Supabase config from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("supabaseConfig");
    if (stored) {
      try {
        const config = JSON.parse(stored);
        setSupabaseConfig(config);
        setIsConfigValid(true);
      } catch (error) {
        console.warn("Failed to load stored Supabase config");
      }
    }
  }, []);

  // Handle Supabase config submission
  const handleSupabaseConfigSubmit = useCallback((config: SupabaseConfig) => {
    setSupabaseConfig(config);
    setIsConfigValid(true);
    localStorage.setItem("supabaseConfig", JSON.stringify(config));
    console.log("Supabase configuration saved:", {
      url: config.supabaseUrl,
      hasAnonKey: !!config.supabaseAnonKey,
      hasToken: !!config.supabaseToken,
      hasDbUrl: !!config.databaseUrl,
    });
  }, []);

  // Load user from localStorage on component mount
  useEffect(() => {
    const loadUserFromStorage = () => {
      const storedUser = localStorage.getItem('dbUser');
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setDbUser(parsedUser);
          console.log('✅ User loaded from localStorage:', parsedUser);
        } catch (error) {
          console.warn('Failed to parse stored user');
          localStorage.removeItem('dbUser');
        }
      }
    };

    loadUserFromStorage();
  }, []);

  // Clear localStorage on sign out
  useEffect(() => {
    if (isLoaded && !clerkUser) {
      localStorage.removeItem('dbUser');
      setDbUser(null);
      setProjects([]);
      setWorkflowActive(false);
      setWorkflowMessages([]);
      console.log('🔄 User signed out, localStorage cleared');
    }
  }, [isLoaded, clerkUser]);

  // User sync helper function with localStorage
  const syncUserWithBackend = async (clerkUser: any): Promise<DbUser | null> => {
    try {
      const storedUser = localStorage.getItem('dbUser');
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          if (parsedUser.clerkId === clerkUser.id) {
            console.log('✅ Using cached user from localStorage:', parsedUser);
            return parsedUser;
          }
        } catch (error) {
          console.warn('Failed to parse stored user, will sync with backend');
        }
      }

      const userData = {
        clerkId: clerkUser.id,
        email: clerkUser.emailAddresses[0]?.emailAddress || "",
        name: clerkUser.fullName || clerkUser.firstName || "User",
        phoneNumber: clerkUser.phoneNumbers[0]?.phoneNumber || null,
        profileImage: clerkUser.imageUrl || null,
      };

      console.log('🔍 Syncing user with backend:', userData);

      const userResponse = await axios.post<DbUser>(
        `${BASE_URL}/api/users`,
        userData
      );

      console.log('✅ User synced successfully:', userResponse.data);
      
      localStorage.setItem('dbUser', JSON.stringify(userResponse.data));
      console.log('💾 User saved to localStorage');
      
      return userResponse.data;

    } catch (error) {
      console.error('❌ Failed to sync user with backend:', error);
      
      const fallbackUser = {
        id: 1,
        clerkId: clerkUser.id,
        email: clerkUser.emailAddresses[0]?.emailAddress || "",
        name: clerkUser.fullName || clerkUser.firstName || "User",
        phoneNumber: clerkUser.phoneNumbers[0]?.phoneNumber || null,
        profileImage: clerkUser.imageUrl || null,
      };
      
      localStorage.setItem('dbUser', JSON.stringify(fallbackUser));
      return fallbackUser;
    }
  };

  // Handle image selection
  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedImages(files.slice(0, 5)); // Limit to 5 images
  }, []);

  // Reset workflow
  const resetWorkflow = useCallback(() => {
    setWorkflowActive(false);
    setWorkflowMessages([]);
    setCurrentStep("analyze");
    setDesignChoices(null);
    setReadyToGenerate(false);
    setCurrentProjectId(null);
    setSelectedImages([]);
    setPrompt("");
  }, []);

  // Start design workflow
  const startWorkflow = useCallback(async () => {
    if (!dbUser || !prompt.trim()) {
      console.error("User not authenticated or prompt is empty");
      return;
    }

    if (!isConfigValid) {
      setShowSupabaseConfig(true);
      return;
    }

    setIsLoading(true);
    setWorkflowActive(true);
    setWorkflowMessages([]);
    setDesignChoices(null);
    setReadyToGenerate(false);

    try {
      // Create project first
      const projectData = {
        userId: dbUser.id,
        clerkId: dbUser.clerkId,
        name: `Design Project ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString(
          [],
          { hour: "2-digit", minute: "2-digit" }
        )}`,
        description: prompt.length > 100 ? prompt.substring(0, 100) + "..." : prompt,
        projectType: "design",
        status: "analyzing",
      };

      const projectResponse = await axios.post<Project>(
        `${BASE_URL}/api/projects`,
        projectData
      );
      
      setCurrentProjectId(projectResponse.data.id);

      // Add user message to workflow
      const userMessage: WorkflowMessage = {
        id: `user-${Date.now()}`,
        content: prompt,
        type: "user",
        timestamp: new Date(),
      };
      setWorkflowMessages([userMessage]);

      // Call analyze endpoint with images
      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('userId', dbUser.id.toString());
      formData.append('projectId', projectResponse.data.id.toString());
      
      selectedImages.forEach((image, index) => {
        formData.append('images', image);
      });

      console.log('🚀 Starting workflow analysis...');
      const analyzeResponse = await axios.post(
        `${BASE_URL}/api/design/analyze`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      console.log('📊 Analyze response:', analyzeResponse.data);

      if (analyzeResponse.data.success) {
        // Process the design choices from the response
        let processedDesignChoices = analyzeResponse.data.designChoices;
        
        // If designChoices doesn't have a proper colorScheme, create one from API response
        if (processedDesignChoices && !processedDesignChoices.colorScheme) {
          const extractedColors = extractColorsFromDesignChoices(processedDesignChoices);
          processedDesignChoices.colorScheme = extractedColors;
        }

        console.log('🎨 Processed design choices:', processedDesignChoices);

        const assistantMessage: WorkflowMessage = {
          id: `assistant-${Date.now()}`,
          content: analyzeResponse.data.message,
          type: "assistant",
          timestamp: new Date(),
          step: analyzeResponse.data.step,
          designChoices: processedDesignChoices,
        };

        setWorkflowMessages(prev => [...prev, assistantMessage]);
        setCurrentStep(analyzeResponse.data.step);
        setDesignChoices(processedDesignChoices);
        setReadyToGenerate(analyzeResponse.data.readyToGenerate || false);
      }
    } catch (error) {
      console.error("Error starting workflow:", error);
      const errorMessage: WorkflowMessage = {
        id: `error-${Date.now()}`,
        content: "Sorry, I encountered an error while analyzing your request. Please try again.",
        type: "assistant",
        timestamp: new Date(),
      };
      setWorkflowMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [dbUser, prompt, isConfigValid, selectedImages]);

  // Handle feedback submission
  const handleFeedbackSubmit = useCallback(async (feedback: string) => {
    if (!currentProjectId || !dbUser) return;

    setIsProcessingFeedback(true);

    const userMessage: WorkflowMessage = {
      id: `user-${Date.now()}`,
      content: feedback,
      type: "user",
      timestamp: new Date(),
    };

    setWorkflowMessages(prev => [...prev, userMessage]);

    try {
      console.log('💬 Submitting feedback:', feedback);
      const feedbackResponse = await axios.post(
        `${BASE_URL}/api/design/feedback`,
        {
          feedback,
          userId: dbUser.id.toString(),
          projectId: currentProjectId,
        }
      );

      console.log('📊 Feedback response:', feedbackResponse.data);

      if (feedbackResponse.data.success) {
        // Process the design choices from the response
        let processedDesignChoices = feedbackResponse.data.designChoices;
        
        // If designChoices doesn't have a proper colorScheme, create one from API response
        if (processedDesignChoices && !processedDesignChoices.colorScheme) {
          const extractedColors = extractColorsFromDesignChoices(processedDesignChoices);
          processedDesignChoices.colorScheme = extractedColors;
        }

        console.log('🎨 Updated design choices:', processedDesignChoices);

        const assistantMessage: WorkflowMessage = {
          id: `assistant-${Date.now()}`,
          content: feedbackResponse.data.message,
          type: "assistant",
          timestamp: new Date(),
          step: feedbackResponse.data.step,
          designChoices: processedDesignChoices,
        };

        setWorkflowMessages(prev => [...prev, assistantMessage]);
        setCurrentStep(feedbackResponse.data.step);
        setDesignChoices(processedDesignChoices);
        setReadyToGenerate(feedbackResponse.data.readyToGenerate || false);
      }
    } catch (error) {
      console.error("Error processing feedback:", error);
      const errorMessage: WorkflowMessage = {
        id: `error-${Date.now()}`,
        content: "Sorry, I encountered an error processing your feedback. Please try again.",
        type: "assistant",
        timestamp: new Date(),
      };
      setWorkflowMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessingFeedback(false);
    }
  }, [currentProjectId, dbUser]);

  // Generate final application
  const generateApplication = useCallback(async () => {
    if (!currentProjectId || !dbUser || !supabaseConfig) return;

    const loadingMessage: WorkflowMessage = {
      id: `loading-${Date.now()}`,
      content: "Perfect! I'm now generating your complete application with the design choices we've finalized. This will include frontend generation and deployment...",
      type: "assistant",
      timestamp: new Date(),
      isLoading: true,
    };

    setWorkflowMessages(prev => [...prev, loadingMessage]);

    try {
      // Generate structure and backend first

      // Navigate to chat page for frontend generation
      navigate("/chatPage", {
        state: {
          projectId: currentProjectId,
          existingProject: true,
          clerkId: dbUser.clerkId,
          userId: dbUser.id,
          supabaseConfig: supabaseConfig,
          fromWorkflow: true,
        },
      });

    } catch (error) {
      console.error("Error generating application:", error);
      const errorMessage: WorkflowMessage = {
        id: `error-${Date.now()}`,
        content: "Sorry, I encountered an error while generating your application. Please try again.",
        type: "assistant",
        timestamp: new Date(),
      };
      setWorkflowMessages(prev => [...prev, errorMessage]);
    }
  }, [currentProjectId, dbUser, supabaseConfig, navigate]);

  // Memoized handlers
  const handlePromptChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setPrompt(e.target.value);
    },
    []
  );

  const handleProjectClick = useCallback(
    (project: Project) => {
      navigate("/chatPage", {
        state: {
          projectId: project.id,
          existingProject: true,
          clerkId: dbUser?.clerkId,
          userId: dbUser?.id,
          supabaseConfig: supabaseConfig,
        },
      });
    },
    [navigate, dbUser, supabaseConfig]
  );

  const handleContinueChat = useCallback(
    (project: Project, e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      navigate("/chatPage", {
        state: {
          projectId: project.id,
          existingProject: true,
          clerkId: dbUser?.clerkId,
          userId: dbUser?.id,
          supabaseConfig: supabaseConfig,
        },
      });
    },
    [navigate, dbUser, supabaseConfig]
  );

  const handleDeleteProject = useCallback(
    async (projectId: number, e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();

      if (!window.confirm("Are you sure you want to delete this project? This will also delete all associated messages.")) {
        return;
      }

      try {
        await axios.delete(`${BASE_URL}/api/projects/${projectId}`);
        setProjects((prev) => prev.filter((p) => p.id !== projectId));
      } catch (error) {
        console.error("Error deleting project:", error);
      }
    },
    []
  );

  // Sync user with database and fetch projects
  useEffect(() => {
    const syncUserAndFetchProjects = async () => {
      if (!isLoaded || !clerkUser) return;

      try {
        const backendUser = await syncUserWithBackend(clerkUser);
        
        if (!backendUser) {
          console.error('❌ Failed to sync user with backend');
          return;
        }

        if (!dbUser || dbUser.id !== backendUser.id) {
          setDbUser(backendUser);
          console.log('✅ Database user updated:', backendUser);
        }

        setLoadingProjects(true);
        try {
          const projectsResponse = await axios.get<Project[]>(
            `${BASE_URL}/api/projects/user/${backendUser.id}`
          );

          const fetchedProjects = projectsResponse.data;
          setProjects(fetchedProjects);
          console.log(`✅ Fetched ${fetchedProjects.length} projects for user ${backendUser.id}`);

        } catch (projectError) {
          console.warn("Could not fetch projects:", projectError);
          setProjects([]);
        }
      } catch (error) {
        console.error("Error syncing user or fetching projects:", error);
      } finally {
        setLoadingProjects(false);
      }
    };

    syncUserAndFetchProjects();
  }, [clerkUser, isLoaded]);

  // Memoized project cards
  const memoizedProjectCards = useMemo(() => {
    const sortedProjects = [...projects].sort((a, b) => {
      const aMessages = a.messageCount || 0;
      const bMessages = b.messageCount || 0;

      if (aMessages !== bMessages) {
        return bMessages - aMessages;
      }

      const aTime = new Date(a.updatedAt || a.createdAt).getTime();
      const bTime = new Date(b.updatedAt || b.createdAt).getTime();
      if (aTime !== bTime) {
        return bTime - aTime;
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return sortedProjects.map((project, index) => (
      <motion.div
        key={project.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
      >
        <ProjectCard
          project={project}
          onProjectClick={handleProjectClick}
          onDeleteProject={handleDeleteProject}
          onContinueChat={handleContinueChat}
          onPreviewDesign={(designChoices) => {
            console.log('🎨 Opening design preview with:', designChoices);
            setSelectedDesignForPreview(designChoices);
            setShowDesignPreview(true);
          }}
        />
      </motion.div>
    ));
  }, [
    projects,
    handleProjectClick,
    handleDeleteProject,
    handleContinueChat,
  ]);

  // Memoized project stats
  const projectStats = useMemo(() => {
    const activeProjects = projects.filter((p) => p.status === "ready").length;
    const projectsWithChats = projects.filter((p) => (p.messageCount || 0) > 0).length;
    const totalMessages = projects.reduce((sum, p) => sum + (p.messageCount || 0), 0);

    return {
      count: projects.length,
      active: activeProjects,
      withChats: projectsWithChats,
      totalMessages,
      text: `${projects.length} project${projects.length !== 1 ? "s" : ""} • ${activeProjects} ready`,
      chatsText: projectsWithChats > 0 ? ` • ${projectsWithChats} with chats` : "",
      messagesText: totalMessages > 0 ? ` • ${totalMessages} messages` : "",
    };
  }, [projects]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && prompt.trim() && !workflowActive) {
        startWorkflow();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [prompt, startWorkflow, workflowActive]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        className="bg-gradient-to-br from-black via-neutral-950 to-black min-h-screen min-w-full flex flex-col items-center justify-center relative overflow-hidden"
      >
        {/* Animated background particles */}
        <div className="absolute inset-0 overflow-hidden">
          {Array.from({ length: 50 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-blue-500/20 rounded-full"
              initial={{
                x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1920),
                y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 1080),
              }}
              animate={{
                x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1920),
                y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 1080),
              }}
              transition={{
                duration: Math.random() * 20 + 10,
                repeat: Infinity,
                repeatType: "reverse",
              }}
            />
          ))}
        </div>

        {/* Authentication Header */}
        <motion.header
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="absolute top-6 right-6 z-20 flex items-center gap-4"
        >
          <SignedIn>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowSupabaseConfig(true)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all duration-200 ${
                isConfigValid
                  ? "bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20"
                  : "bg-orange-500/10 border-orange-500/20 text-orange-400 hover:bg-orange-500/20"
              }`}
              title={
                isConfigValid ? "Supabase configured" : "Configure Supabase"
              }
            >
              <Database className="w-4 h-4" />
              <span className="hidden sm:inline">
                {isConfigValid ? "Backend Ready" : "Setup Backend"}
              </span>
              <div
                className={`w-2 h-2 rounded-full ${
                  isConfigValid ? "bg-green-500" : "bg-orange-500"
                }`}
              ></div>
            </motion.button>
          </SignedIn>

          <SignedOut>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <SignInButton>
                <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors duration-200">
                  Sign In
                </button>
              </SignInButton>
            </motion.div>
          </SignedOut>
          <SignedIn>
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "w-10 h-10",
                  userButtonPopoverCard: "bg-neutral-900 border-neutral-700",
                  userButtonPopoverText: "text-white",
                },
              }}
            />
          </SignedIn>
        </motion.header>

        {/* Main Content Container */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6">
          {/* Title */}
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{
              duration: 1.2,
              ease: "easeOut",
              delay: 0.3,
            }}
            className="flex items-center justify-center mb-8"
          >
            <motion.div
              animate={{
                filter: [
                  "drop-shadow(0 0 0px rgba(255,255,255,0))",
                  "drop-shadow(0 0 20px rgba(255,255,255,0.3))",
                  "drop-shadow(0 0 0px rgba(255,255,255,0))",
                ],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <img
                src="/main.png"
                alt="CodePup Logo"
                className="w-24 h-24 md:w-32 md:h-32 object-contain"
              />
            </motion.div>

            <motion.h1
              className="text-6xl px-2 md:text-8xl bg-gradient-to-b tracking-tighter from-white via-white to-transparent bg-clip-text text-transparent font-bold"
              animate={{
                textShadow: [
                  "0 0 0px rgba(255,255,255,0)",
                  "0 0 20px rgba(255,255,255,0.1)",
                  "0 0 0px rgba(255,255,255,0)",
                ],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              CodePup
            </motion.h1>
          </motion.div>

          {/* Content only visible when signed in */}
          <SignedIn>
            {/* Configuration Required Message */}
            {!isConfigValid && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8, delay: 1.1 }}
                className="mb-8 text-center"
              >
                <div className="inline-flex items-center gap-2 px-4 py-3 bg-orange-500/10 border border-orange-500/20 rounded-lg text-orange-400">
                  <Database className="w-5 h-5" />
                  <span className="text-sm font-medium">
                    Backend configuration required to create projects
                  </span>
                  <button
                    onClick={() => setShowSupabaseConfig(true)}
                    className="ml-2 px-3 py-1 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 text-xs rounded transition-colors"
                  >
                    Configure Now
                  </button>
                </div>
              </motion.div>
            )}

            {/* Main content area - workflow or prompt input */}
            {!workflowActive ? (
              /* Initial Prompt Input Section */
              <div className="flex flex-col items-center mb-12">
                <motion.div
                  initial={{ y: 30, opacity: 0, scale: 0.9 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  transition={{
                    duration: 1,
                    ease: "easeOut",
                    delay: 1.2,
                  }}
                  className="w-full max-w-3xl"
                >
                  {/* Image upload section */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-neutral-300 mb-3">
                      <ImageIcon className="w-4 h-4 inline mr-2" />
                      Add reference images (optional)
                    </label>
                    <div className="relative">
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="hidden"
                        id="image-upload"
                        disabled={!isConfigValid}
                      />
                      <label
                        htmlFor="image-upload"
                        className={`flex items-center justify-center w-full p-6 border-2 border-dashed rounded-lg transition-all duration-300 cursor-pointer ${
                          isConfigValid
                            ? "border-neutral-600 hover:border-neutral-500 bg-neutral-900/30 hover:bg-neutral-800/50"
                            : "border-neutral-700 bg-neutral-900/20 cursor-not-allowed"
                        }`}
                      >
                        <div className="text-center">
                          <Upload className="w-8 h-8 text-neutral-500 mx-auto mb-2" />
                          <p className="text-sm text-neutral-400">
                            {selectedImages.length > 0
                              ? `${selectedImages.length} image${selectedImages.length > 1 ? 's' : ''} selected`
                              : "Click to upload reference images"}
                          </p>
                          <p className="text-xs text-neutral-600 mt-1">
                            PNG, JPG, GIF up to 3.75MB (max 5 images)
                          </p>
                        </div>
                      </label>
                    </div>

                    {/* Selected images preview */}
                    {selectedImages.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {selectedImages.map((image, index) => (
                          <div
                            key={index}
                            className="relative w-16 h-16 bg-neutral-800 rounded-lg overflow-hidden"
                          >
                            <img
                              src={URL.createObjectURL(image)}
                              alt={`Preview ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                            <button
                              onClick={() => setSelectedImages(prev => prev.filter((_, i) => i !== index))}
                              className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600 transition-colors"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <motion.textarea
                    whileFocus={{
                      scale: 1.02,
                      boxShadow: "0 0 0 2px rgba(96, 165, 250, 0.3)",
                    }}
                    value={prompt}
                    onChange={handlePromptChange}
                    placeholder={
                      !isConfigValid
                        ? "Configure backend settings first to create projects..."
                        : "Describe your app idea in detail... (Ctrl/Cmd + Enter to start design process)"
                    }
                    className="mb-4 border-2 focus:outline-0 border-neutral-400 rounded-lg text-white p-4 w-full h-36 bg-black/50 backdrop-blur-sm transition-all duration-300 placeholder-neutral-500 resize-none"
                    disabled={!isConfigValid}
                  />

                  <motion.button
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{
                      duration: 1,
                      ease: "easeOut",
                      delay: 1.5,
                    }}
                    whileHover={{
                      scale: isConfigValid && prompt.trim() ? 1.05 : 1,
                      boxShadow:
                        isConfigValid && prompt.trim()
                          ? "0 10px 25px rgba(96, 165, 250, 0.3)"
                          : "none",
                    }}
                    whileTap={{ scale: isConfigValid && prompt.trim() ? 0.95 : 1 }}
                    className="w-full px-7 rounded-lg py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium flex items-center justify-center gap-2"
                    onClick={startWorkflow}
                    disabled={isLoading || !prompt.trim() || !isConfigValid}
                  >
                    <motion.span
                      animate={
                        isLoading
                          ? {
                              opacity: [1, 0.5, 1],
                            }
                          : {}
                      }
                      transition={
                        isLoading
                          ? {
                              duration: 1,
                              repeat: Infinity,
                              ease: "easeInOut",
                            }
                          : {}
                      }
                      className="flex items-center gap-2"
                    >
                      {isLoading ? (
                        <>
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{
                              duration: 1,
                              repeat: Infinity,
                              ease: "linear",
                            }}
                            className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                          />
                          Analyzing Design...
                        </>
                      ) : !isConfigValid ? (
                        "Configure Backend First"
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Start Design Process
                        </>
                      )}
                    </motion.span>
                  </motion.button>
                </motion.div>
              </div>
            ) : (
              /* Workflow Active - Design Process */
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-5xl mx-auto mb-12"
              >
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Chat Messages - Left Side */}
                  <div className="lg:col-span-2">
                    <div className="bg-gradient-to-br from-neutral-900/80 to-neutral-800/80 backdrop-blur-sm border border-neutral-700/50 rounded-xl">
                      {/* Header */}
                      <div className="p-4 border-b border-neutral-700/50">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Settings className="w-5 h-5 text-blue-400" />
                            Design Process
                          </h3>
                          <div className="flex items-center gap-2">
                            <div className="text-sm text-neutral-400">
                              Step: {currentStep}
                            </div>
                            <button
                              onClick={resetWorkflow}
                              className="p-1 text-neutral-400 hover:text-white transition-colors"
                              title="Start new design"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Messages */}
                      <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
                        <AnimatePresence>
                          {workflowMessages.map((message) => (
                            <motion.div
                              key={message.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={`flex ${
                                message.type === "user" ? "justify-end" : "justify-start"
                              }`}
                            >
                              <div
                                className={`max-w-[80%] p-3 rounded-lg ${
                                  message.type === "user"
                                    ? "bg-blue-600/20 border border-blue-500/30 text-white"
                                    : "bg-neutral-800/50 border border-neutral-700/50 text-neutral-200"
                                }`}
                              >
                                <p className="text-sm whitespace-pre-wrap">
                                  {message.content}
                                  {message.isLoading && (
                                    <span className="inline-block ml-2">
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    </span>
                                  )}
                                </p>
                                <span className="text-xs text-neutral-500 mt-1 block">
                                  {message.timestamp.toLocaleTimeString()}
                                </span>
                              </div>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                        <div ref={messagesEndRef} />
                      </div>

                      {/* Input or Actions */}
                      <div className="p-4 border-t border-neutral-700/50">
                        {readyToGenerate ? (
                          <motion.button
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={generateApplication}
                            className="w-full px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2"
                          >
                            <CheckCircle className="w-5 h-5" />
                            Generate Complete Application
                            <ArrowRight className="w-4 h-4" />
                          </motion.button>
                        ) : (
                          <FeedbackInput onSubmit={handleFeedbackSubmit} isLoading={isProcessingFeedback} />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Design Preview - Right Side */}
                  <div className="lg:col-span-1">
                    {designChoices && (
                      <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                      >
                        <DesignPreview designChoices={designChoices} />
                        
                        {/* Preview button */}
                        <motion.button
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            console.log('🎨 Opening expandable design preview with:', designChoices);
                            setSelectedDesignForPreview(designChoices);
                            setShowDesignPreview(true);
                          }}
                          className="w-full mt-3 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2"
                        >
                          <Eye className="w-5 h-5" />
                          Preview Design
                        </motion.button>
                      </motion.div>
                    )}
                    
                    {/* Progress indicator */}
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 }}
                      className="mt-6 p-4 bg-gradient-to-br from-neutral-900/50 to-neutral-800/50 rounded-xl border border-neutral-700/50"
                    >
                      <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                        <Eye className="w-4 h-4 text-purple-400" />
                        Progress
                      </h4>
                      <div className="space-y-2">
                        <div className={`flex items-center gap-2 text-sm ${
                          currentStep === "analyze" ? "text-blue-400" : 
                          currentStep === "feedback" || readyToGenerate ? "text-green-400" : "text-neutral-500"
                        }`}>
                          <div className={`w-2 h-2 rounded-full ${
                            currentStep === "analyze" ? "bg-blue-400" : 
                            currentStep === "feedback" || readyToGenerate ? "bg-green-400" : "bg-neutral-600"
                          }`} />
                          Design Analysis
                        </div>
                        <div className={`flex items-center gap-2 text-sm ${
                          currentStep === "feedback" ? "text-blue-400" : 
                          readyToGenerate ? "text-green-400" : "text-neutral-500"
                        }`}>
                          <div className={`w-2 h-2 rounded-full ${
                            currentStep === "feedback" ? "bg-blue-400" : 
                            readyToGenerate ? "bg-green-400" : "bg-neutral-600"
                          }`} />
                          Refinement
                        </div>
                        <div className={`flex items-center gap-2 text-sm ${
                          readyToGenerate ? "text-blue-400" : "text-neutral-500"
                        }`}>
                          <div className={`w-2 h-2 rounded-full ${
                            readyToGenerate ? "bg-blue-400" : "bg-neutral-600"
                          }`} />
                          Generation Ready
                        </div>
                      </div>
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Projects Section */}
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{
                duration: 1,
                ease: "easeOut",
                delay: 1.8,
              }}
              className="w-full"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold text-white">
                  Your Projects
                </h2>
                <div className="text-right">
                  <div className="text-neutral-400 text-sm">
                    {projectStats.text}
                    {projectStats.chatsText}
                  </div>
                  {projectStats.totalMessages > 0 && (
                    <div className="text-neutral-500 text-xs">
                      {projectStats.totalMessages} total messages
                    </div>
                  )}
                </div>
              </div>

              {loadingProjects ? (
                <div className="flex items-center justify-center py-12">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                    className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full"
                  />
                </div>
              ) : projects.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {memoizedProjectCards}
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-12"
                >
                  <Code2 className="w-16 h-16 text-neutral-600 mx-auto mb-4" />
                  <h3 className="text-xl font-medium text-white mb-2">
                    No projects yet
                  </h3>
                  <p className="text-neutral-400 mb-4">
                    {!isConfigValid
                      ? "Configure your backend settings to start creating projects"
                      : "Create your first project by entering a prompt above"}
                  </p>
                  {!isConfigValid && (
                    <button
                      onClick={() => setShowSupabaseConfig(true)}
                      className="px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 rounded-lg transition-colors text-sm"
                    >
                      Configure Backend
                    </button>
                  )}
                </motion.div>
              )}
            </motion.div>
          </SignedIn>

          {/* Message for signed out users */}
          <SignedOut>
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{
                duration: 1,
                ease: "easeOut",
                delay: 1.2,
              }}
              className="text-center"
            >
              <p className="text-neutral-400 mb-4">
                Please sign in to start building your projects
              </p>
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <SignInButton>
                  <button className="px-8 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors duration-200">
                    Get Started
                  </button>
                </SignInButton>
              </motion.div>
            </motion.div>
          </SignedOut>
        </div>
      </motion.div>

      {/* Supabase Configuration Form Modal */}
      <SupabaseConfigForm
        isOpen={showSupabaseConfig}
        onClose={() => setShowSupabaseConfig(false)}
        onSubmit={handleSupabaseConfigSubmit}
        initialConfig={supabaseConfig || {}}
      />
      
      {/* Expandable Design Preview Modal */}
      <ExpandableDesignPreview
        designChoices={selectedDesignForPreview || {}}
        isOpen={showDesignPreview}
        onClose={() => setShowDesignPreview(false)}
        onGenerate={() => {
          setShowDesignPreview(false);
          generateApplication();
        }}
        projectName={selectedDesignForPreview ? "Design Preview" : "Project Preview"}
      />
    </>
  );
};

export default Index;