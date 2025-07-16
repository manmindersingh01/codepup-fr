import React, { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Eye,
  X,
  Palette,
  Code2,
  Smartphone,
  Monitor,
  Tablet,
  Copy,
  Check,
  Package,
  Layout,
  Type,
  Sparkles,
  ExternalLink,
  Play,
  Settings,
} from "lucide-react";

// --- Updated Types to match API response ---
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
  typography?: string;
  theme?: string;
}

interface ExpandableDesignPreviewProps {
  designChoices: DesignChoices;
  isOpen: boolean;
  onClose: () => void;
  onGenerate?: () => void;
  projectName?: string;
}

// Helper function to extract colors from design choices (same as in Index.tsx)
const extractColorsFromDesignChoices = (designChoices: DesignChoices) => {
  console.log('🎨 ExpandableDesignPreview - Extracting colors from:', designChoices);
  
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
    console.log('🎨 ExpandableDesignPreview - Using recommendedColors:', designChoices.recommendedColors);
    colors.primary = colors.primary || designChoices.recommendedColors[0];
    colors.secondary = colors.secondary || designChoices.recommendedColors[1];
    colors.accent = colors.accent || designChoices.recommendedColors[2];
    colors.background = colors.background || designChoices.recommendedColors[3];
    colors.text = colors.text || designChoices.recommendedColors[4];
  }

  // If still no colors, try allColorOptions
  if (!colors.primary && designChoices.allColorOptions && designChoices.allColorOptions.length > 0) {
    console.log('🎨 ExpandableDesignPreview - Using allColorOptions:', designChoices.allColorOptions);
    colors.primary = designChoices.allColorOptions[0];
    colors.secondary = designChoices.allColorOptions[1];
    colors.accent = designChoices.allColorOptions[2];
    colors.background = designChoices.allColorOptions[3];
    colors.text = designChoices.allColorOptions[4];
  }

  console.log('🎨 ExpandableDesignPreview - Final extracted colors:', colors);
  return colors;
};

// --- Components ---
const ColorSwatch = React.memo(({ 
  color, 
  name, 
  size = "medium" 
}: { 
  color: string; 
  name: string; 
  size?: "small" | "medium" | "large";
}) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(color);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy color:', err);
    }
  }, [color]);

  const sizeClasses = {
    small: "w-8 h-8",
    medium: "w-12 h-12", 
    large: "w-16 h-16"
  };

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={copyToClipboard}
      className="cursor-pointer group p-3 bg-neutral-800/30 rounded-lg border border-neutral-700/50 hover:border-neutral-600 transition-all duration-200"
    >
      <div
        className={`${sizeClasses[size]} rounded-md border-2 border-white/20 mb-2 relative overflow-hidden mx-auto`}
        style={{ backgroundColor: color }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black/10" />
      </div>
      <div className="text-center">
        <p className="font-medium text-white capitalize text-xs mb-1">
          {name}
        </p>
        <p className="text-neutral-400 font-mono text-xs">
          {color}
        </p>
        <div className="flex items-center justify-center mt-1">
          {copied ? (
            <Check className="w-3 h-3 text-green-400" />
          ) : (
            <Copy className="w-3 h-3 text-neutral-500 group-hover:text-neutral-300 transition-colors" />
          )}
        </div>
      </div>
    </motion.div>
  );
});

ColorSwatch.displayName = "ColorSwatch";

const DevicePreview = React.memo(({ 
  designChoices, 
  device = "desktop" 
}: { 
  designChoices: DesignChoices; 
  device: "desktop" | "tablet" | "mobile";
}) => {
  // Extract colors using the helper function
  const extractedColors = extractColorsFromDesignChoices(designChoices);
  
  const primaryColor = extractedColors.primary || '#3B82F6';
  const secondaryColor = extractedColors.secondary || '#10B981';
  const accentColor = extractedColors.accent || '#F59E0B';
  const backgroundColor = extractedColors.background || '#F8FAFC';
  const textColor = extractedColors.text || '#1F2937';

  console.log('🖼️ DevicePreview using colors:', {
    primary: primaryColor,
    secondary: secondaryColor,
    accent: accentColor,
    background: backgroundColor,
    text: textColor
  });

  const getDeviceClasses = () => {
    switch (device) {
      case "mobile":
        return "w-48 h-72 mx-auto";
      case "tablet":
        return "w-64 h-80 mx-auto";
      default:
        return "w-full h-64";
    }
  };

  const businessName = designChoices.businessName || designChoices.businessType || "Your App";

  return (
    <div className={`${getDeviceClasses()} relative bg-white rounded-lg overflow-hidden shadow-xl border border-neutral-300`}>
      {/* Header */}
      <div 
        className="h-10 flex items-center px-3"
        style={{ backgroundColor: primaryColor }}
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-white/20 flex items-center justify-center">
            <Package className="w-3 h-3 text-white" />
          </div>
          <div className="text-white">
            <h3 className="font-medium text-xs">{businessName}</h3>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <div className="w-4 h-4 bg-white/20 rounded-sm"></div>
          <div className="w-4 h-4 bg-white/20 rounded-sm"></div>
        </div>
      </div>

      {/* Navigation */}
      <div className="h-8 bg-white border-b border-gray-200 flex items-center px-3">
        <div className="flex gap-3">
          <div 
            className="px-2 py-1 rounded text-xs font-medium"
            style={{ backgroundColor: secondaryColor, color: 'white' }}
          >
            Home
          </div>
          <div className="px-2 py-1 text-xs text-gray-600">About</div>
          <div className="px-2 py-1 text-xs text-gray-600">Contact</div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-3 space-y-3" style={{ backgroundColor }}>
        {/* Hero */}
        <div className="space-y-2">
          <div 
            className="h-4 rounded"
            style={{ backgroundColor: secondaryColor, width: '70%' }}
          />
          <div className="h-2 bg-gray-300 rounded" style={{ width: '90%' }} />
          <div className="h-2 bg-gray-300 rounded" style={{ width: '60%' }} />
        </div>

        {/* Cards */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white p-2 rounded shadow-sm border">
            <div 
              className="w-full h-8 rounded mb-1"
              style={{ backgroundColor: accentColor, opacity: 0.1 }}
            />
            <div className="h-2 bg-gray-200 rounded mb-1" />
            <div className="h-2 bg-gray-200 rounded" style={{ width: '60%' }} />
          </div>
          <div className="bg-white p-2 rounded shadow-sm border">
            <div 
              className="w-full h-8 rounded mb-1"
              style={{ backgroundColor: primaryColor, opacity: 0.1 }}
            />
            <div className="h-2 bg-gray-200 rounded mb-1" />
            <div className="h-2 bg-gray-200 rounded" style={{ width: '80%' }} />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <button 
            className="px-3 py-1 rounded font-medium text-white text-xs"
            style={{ backgroundColor: primaryColor }}
          >
            Action
          </button>
          <button 
            className="px-3 py-1 rounded font-medium text-xs border"
            style={{ 
              borderColor: accentColor, 
              color: accentColor,
              backgroundColor: 'transparent'
            }}
          >
            Secondary
          </button>
        </div>

        {/* Features */}
        {(designChoices.features || designChoices.differentSections) && (
          <div className="space-y-1">
            {(designChoices.differentSections || designChoices.features || []).slice(0, 2).map((feature, index) => (
              <div key={index} className="flex items-center gap-2">
                <div 
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: accentColor }}
                />
                <span className="text-xs" style={{ color: textColor }}>
                  {feature.length > 20 ? feature.substring(0, 20) + '...' : feature}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

DevicePreview.displayName = "DevicePreview";

// --- Main Component ---
const ExpandableDesignPreview: React.FC<ExpandableDesignPreviewProps> = ({
  designChoices,
  isOpen,
  onClose,
  onGenerate,
  projectName = "Design Preview"
}) => {
  const [activeDevice, setActiveDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");

  // Updated to handle both colorScheme and recommendedColors
  const colorPairs = useMemo(() => {
    const extractedColors = extractColorsFromDesignChoices(designChoices);
    
    // Create color pairs from extracted colors
    const pairs: [string, string][] = [];
    
    if (extractedColors.primary) pairs.push(['primary', extractedColors.primary]);
    if (extractedColors.secondary) pairs.push(['secondary', extractedColors.secondary]);
    if (extractedColors.accent) pairs.push(['accent', extractedColors.accent]);
    if (extractedColors.background) pairs.push(['background', extractedColors.background]);
    if (extractedColors.text) pairs.push(['text', extractedColors.text]);
    
    // If we have recommendedColors but no extracted colors, use those
    if (pairs.length === 0 && designChoices.recommendedColors) {
      designChoices.recommendedColors.forEach((color, index) => {
        const names = ['primary', 'secondary', 'accent', 'background', 'text'];
        if (index < names.length) {
          pairs.push([names[index], color]);
        } else {
          pairs.push([`color-${index + 1}`, color]);
        }
      });
    }
    
    // If still no colors, try allColorOptions
    if (pairs.length === 0 && designChoices.allColorOptions) {
      designChoices.allColorOptions.slice(0, 8).forEach((color, index) => {
        pairs.push([`option-${index + 1}`, color]);
      });
    }
    
    console.log('🎨 ExpandableDesignPreview - Color pairs:', pairs);
    return pairs;
  }, [designChoices]);

  const designStats = useMemo(() => [
    {
      icon: Palette,
      label: "Colors",
      value: colorPairs.length,
      color: "text-blue-400"
    },
    {
      icon: Package,
      label: "Components",
      value: (designChoices.components?.length || 0) + (designChoices.differentSections?.length || 0),
      color: "text-green-400"
    },
    {
      icon: Layout,
      label: "Features",
      value: (designChoices.features?.length || 0) + (designChoices.layoutStyles?.length || 0),
      color: "text-purple-400"
    },
    {
      icon: Type,
      label: "Layouts",
      value: designChoices.differentLayouts?.length || (designChoices.recommendedLayout ? 1 : 0),
      color: "text-yellow-400"
    },
  ], [colorPairs.length, designChoices]);

  const deviceButtons = [
    { key: "desktop" as const, icon: Monitor, label: "Desktop" },
    { key: "tablet" as const, icon: Tablet, label: "Tablet" },
    { key: "mobile" as const, icon: Smartphone, label: "Mobile" },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-2xl border border-neutral-700/50 w-full max-w-6xl max-h-[90vh] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-neutral-700/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg">
                  <Sparkles className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{projectName}</h2>
                  <p className="text-sm text-neutral-400">Design Preview & Color Palette</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {onGenerate && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onGenerate}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg font-medium transition-all duration-200"
                  >
                    <Play className="w-4 h-4" />
                    Generate App
                  </motion.button>
                )}
                
                <button
                  onClick={onClose}
                  className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-700/50 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto max-h-[calc(90vh-88px)]">
              {/* Content */}
              <div className="p-6 space-y-8">
                {/* Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {designStats.map((stat, index) => (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="bg-neutral-800/50 p-4 rounded-xl border border-neutral-700/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-neutral-700/50 rounded-lg">
                          <stat.icon className={`w-4 h-4 ${stat.color}`} />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-white">{stat.value}</p>
                          <p className="text-xs text-neutral-400">{stat.label}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Design Details */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Color Palette */}
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Palette className="w-5 h-5 text-blue-400" />
                      Color Palette
                    </h3>
                    {colorPairs.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {colorPairs.map(([name, color]) => (
                          <ColorSwatch key={name} color={color} name={name} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-neutral-400 text-sm">No colors defined</p>
                    )}
                    
                    {/* Color explanation */}
                    {designChoices.colorExplanation && (
                      <div className="mt-4 p-3 bg-neutral-800/30 rounded-lg border border-neutral-700/50">
                        <p className="text-sm text-neutral-400 mb-1">Color Strategy</p>
                        <p className="text-white text-xs leading-relaxed">{designChoices.colorExplanation}</p>
                      </div>
                    )}
                  </div>

                  {/* Design Info */}
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Settings className="w-5 h-5 text-purple-400" />
                      Design Details
                    </h3>
                    <div className="space-y-4">
                      {(designChoices.businessName || designChoices.businessType) && (
                        <div className="p-3 bg-neutral-800/30 rounded-lg border border-neutral-700/50">
                          <p className="text-sm text-neutral-400 mb-1">Business</p>
                          <p className="text-white font-medium">{designChoices.businessName || designChoices.businessType}</p>
                        </div>
                      )}

                      {designChoices.vibe && (
                        <div className="p-3 bg-neutral-800/30 rounded-lg border border-neutral-700/50">
                          <p className="text-sm text-neutral-400 mb-1">Vibe</p>
                          <p className="text-white font-medium">{designChoices.vibe}</p>
                        </div>
                      )}
                      
                      {(designChoices.style || designChoices.recommendedLayout) && (
                        <div className="p-3 bg-neutral-800/30 rounded-lg border border-neutral-700/50">
                          <p className="text-sm text-neutral-400 mb-1">Layout Style</p>
                          <p className="text-white font-medium">{designChoices.recommendedLayout || designChoices.style}</p>
                        </div>
                      )}

                      {designChoices.recommendedLayoutExplanation && (
                        <div className="p-3 bg-neutral-800/30 rounded-lg border border-neutral-700/50">
                          <p className="text-sm text-neutral-400 mb-1">Layout Explanation</p>
                          <p className="text-white text-xs leading-relaxed">{designChoices.recommendedLayoutExplanation}</p>
                        </div>
                      )}

                      {(designChoices.layout) && (
                        <div className="p-3 bg-neutral-800/30 rounded-lg border border-neutral-700/50">
                          <p className="text-sm text-neutral-400 mb-1">Layout</p>
                          <p className="text-white font-medium">{designChoices.layout}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Layout Options */}
                {designChoices.differentLayouts && designChoices.differentLayouts.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Layout className="w-5 h-5 text-orange-400" />
                      Layout Options ({designChoices.differentLayouts.length})
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {designChoices.differentLayouts.map((layout, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className={`p-3 rounded-lg border transition-all duration-200 ${
                            layout === designChoices.recommendedLayout
                              ? "bg-blue-500/20 border-blue-500/30 text-blue-300"
                              : "bg-neutral-800/30 border-neutral-700/50 text-white"
                          }`}
                        >
                          <span className="text-sm">{layout}</span>
                          {layout === designChoices.recommendedLayout && (
                            <div className="mt-1">
                              <span className="text-xs text-blue-400">Recommended</span>
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Features/Sections */}
                {(designChoices.features || designChoices.differentSections) && (
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Package className="w-5 h-5 text-green-400" />
                      {designChoices.differentSections ? 'Sections' : 'Features'} ({(designChoices.differentSections || designChoices.features || []).length})
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {(designChoices.differentSections || designChoices.features || []).map((item, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="flex items-center gap-3 p-3 bg-neutral-800/30 rounded-lg border border-neutral-700/50"
                        >
                          <div 
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: extractColorsFromDesignChoices(designChoices).accent || '#F59E0B' }}
                          />
                          <span className="text-sm text-white">{item}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Device Preview */}
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Eye className="w-5 h-5 text-blue-400" />
                      Design Preview
                    </h3>
                    
                    {/* Device Selector */}
                    <div className="flex items-center gap-1 p-1 bg-neutral-800/50 rounded-lg border border-neutral-700/50">
                      {deviceButtons.map(({ key, icon: Icon, label }) => (
                        <button
                          key={key}
                          onClick={() => setActiveDevice(key)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-md transition-all duration-200 ${
                            activeDevice === key
                              ? "bg-blue-600 text-white"
                              : "text-neutral-400 hover:text-white hover:bg-neutral-700/50"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="text-sm hidden sm:inline">{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Preview Container */}
                  <div className="bg-gradient-to-br from-neutral-800/30 to-neutral-700/30 p-8 rounded-xl border border-neutral-700/50">
                    <DevicePreview designChoices={designChoices} device={activeDevice} />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ExpandableDesignPreview;