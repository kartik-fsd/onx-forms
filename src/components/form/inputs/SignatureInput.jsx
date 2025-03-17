import { useState, useRef, useEffect } from "preact/hooks";

/**
 * Signature capture input component
 */
const SignatureInput = ({
  id,
  name,
  label,
  value = null,
  onChange,
  required = false,
  disabled = false,
  error,
  hint,
  backgroundColor = "#ffffff",
  penColor = "#000000",
  penWidth = 2,
  className = "",
  ...props
}) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(!!value);
  const canvasRef = useRef(null);
  const contextRef = useRef(null);

  // Initialize canvas on mount and when dimensions change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    // Set canvas dimensions
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    // Get and configure context
    const context = canvas.getContext("2d");
    context.scale(dpr, dpr);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = penWidth;
    context.strokeStyle = penColor;

    // Store context in ref
    contextRef.current = context;

    // If we have a value, draw it on the canvas
    if (value) {
      const img = new Image();
      img.onload = () => {
        context.drawImage(img, 0, 0, rect.width, rect.height);
        setHasSignature(true);
      };
      img.src = value;
    } else {
      // Clear canvas and add background
      context.fillStyle = backgroundColor;
      context.fillRect(0, 0, rect.width, rect.height);
    }
  }, [value, backgroundColor, penColor, penWidth]);

  // Handle window resize to adjust canvas
  useEffect(() => {
    const handleResize = () => {
      // Save current signature
      const dataUrl =
        value || (canvasRef.current ? canvasRef.current.toDataURL() : null);

      // Re-initialize canvas with the saved signature
      const canvas = canvasRef.current;
      if (!canvas) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();

      // Update canvas dimensions
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      // Reconfigure context
      const context = canvas.getContext("2d");
      context.scale(dpr, dpr);
      context.lineCap = "round";
      context.lineJoin = "round";
      context.lineWidth = penWidth;
      context.strokeStyle = penColor;

      // Restore signature if it exists
      if (dataUrl && hasSignature) {
        const img = new Image();
        img.onload = () => {
          context.drawImage(img, 0, 0, rect.width, rect.height);
        };
        img.src = dataUrl;
      } else {
        // Clear canvas and add background
        context.fillStyle = backgroundColor;
        context.fillRect(0, 0, rect.width, rect.height);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [hasSignature, value, backgroundColor, penColor, penWidth]);

  // Handle start drawing
  const startDrawing = (e) => {
    if (disabled) return;

    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!canvas || !context) return;

    setIsDrawing(true);

    // Get the correct coordinates based on event type
    const rect = canvas.getBoundingClientRect();
    const x = e.type.includes("touch")
      ? e.touches[0].clientX - rect.left
      : e.clientX - rect.left;
    const y = e.type.includes("touch")
      ? e.touches[0].clientY - rect.top
      : e.clientY - rect.top;

    context.beginPath();
    context.moveTo(x, y);
  };

  // Handle drawing
  const draw = (e) => {
    if (!isDrawing || disabled) return;

    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!canvas || !context) return;

    // Get the correct coordinates based on event type
    const rect = canvas.getBoundingClientRect();
    const x = e.type.includes("touch")
      ? e.touches[0].clientX - rect.left
      : e.clientX - rect.left;
    const y = e.type.includes("touch")
      ? e.touches[0].clientY - rect.top
      : e.clientY - rect.top;

    context.lineTo(x, y);
    context.stroke();

    // Set hasSignature as soon as drawing starts
    if (!hasSignature) {
      setHasSignature(true);
    }
  };

  // Handle end drawing
  const endDrawing = () => {
    if (!isDrawing || disabled) return;

    const context = contextRef.current;
    if (context) {
      context.closePath();
    }

    setIsDrawing(false);

    // If we have a signature, save it
    if (hasSignature && canvasRef.current) {
      const dataUrl = canvasRef.current.toDataURL("image/png");
      onChange(dataUrl);
    }
  };

  // Handle clear signature
  const handleClear = () => {
    if (disabled) return;

    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!canvas || !context) return;

    const rect = canvas.getBoundingClientRect();

    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, rect.width, rect.height);

    setHasSignature(false);
    onChange(null);
  };

  return (
    <div className={`relative ${className}`}>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-gray-700 mb-2"
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <div className="border border-gray-300 rounded-md overflow-hidden">
        {/* Signature canvas */}
        <div
          className="relative w-full h-36 touch-none"
          style={{ background: backgroundColor }}
        >
          <canvas
            ref={canvasRef}
            className="w-full h-full cursor-crosshair"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={endDrawing}
            onMouseLeave={endDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={endDrawing}
            aria-label="Signature input"
          />

          {/* Signature line */}
          <div
            className="absolute bottom-6 left-4 right-4 border-b border-gray-400"
            style={{ pointerEvents: "none" }}
          />
        </div>

        {/* Controls */}
        <div className="flex justify-end items-center px-3 py-2 bg-gray-50 border-t border-gray-300">
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled || !hasSignature}
            className="text-sm text-red-600 hover:text-red-800 focus:outline-none focus:underline disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Clear Signature
          </button>
        </div>
      </div>

      {/* Error message or hint */}
      {(error || hint) && (
        <p
          id={`${id}-description`}
          className={`mt-1 text-sm ${error ? "text-red-600" : "text-gray-500"}`}
        >
          {error || hint}
        </p>
      )}
    </div>
  );
};

export default SignatureInput;
