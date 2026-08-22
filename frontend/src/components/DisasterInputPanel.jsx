import {
  useState,
  useRef,
  useEffect,
} from "react";

import {
  FaMapMarkerAlt,
  FaCamera,
  FaTrashAlt,
  FaExclamationCircle,
  FaCloudUploadAlt,
  FaArrowRight,
  FaSpinner,
  FaImages,
  FaTimes,
} from "react-icons/fa";

import useGeolocation from "../hooks/useGeolocation";


export default function DisasterInputPanel({
  onAnalyze,
  loading = false,
  apiError = null,
  initialValues = null,
  onLocationDetected = null,
}) {

  // ============================================================
  // STATE
  // ============================================================

  const [location, setLocation] = useState(
    initialValues?.location || ""
  );

  const [description, setDescription] = useState(
    initialValues?.description || ""
  );

  const [images, setImages] = useState(
    initialValues?.images || []
  );

  const [previewUrls, setPreviewUrls] = useState([]);

  const [isDragging, setIsDragging] = useState(false);

  const [errors, setErrors] = useState({});

  const [cameraOpen, setCameraOpen] = useState(false);

  const [cameraError, setCameraError] = useState(null);

  const [geoLocating, setGeoLocating] = useState(false);

  const [geoAlert, setGeoAlert] = useState(null);


  // ============================================================
  // GEOLOCATION
  // ============================================================

  const {
    coords,
    error: geoError,
    refetch: getGeoLocation,
  } = useGeolocation({
    auto: false,
  });


  // ============================================================
  // REFS
  // ============================================================

  const fileInputRef = useRef(null);

  const videoRef = useRef(null);

  const canvasRef = useRef(null);

  const streamRef = useRef(null);


  // ============================================================
  // INITIAL VALUES UPDATE
  // ============================================================

  useEffect(() => {

    if (initialValues?.location !== undefined) {
      setLocation(initialValues.location || "");
    }

    if (initialValues?.description !== undefined) {
      setDescription(initialValues.description || "");
    }

    if (initialValues?.images) {
      setImages(initialValues.images);
    }

  }, [initialValues]);


  // ============================================================
  // REVERSE GEOCODING
  // ============================================================

  const reverseGeocode = async (lat, lng) => {

    try {

      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            "Accept-Language": "en",
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          "Failed to resolve address."
        );
      }

      const data = await response.json();

      const displayName =
        data.display_name ||
        `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

      setLocation(displayName);

      setErrors((prev) => {
        const next = { ...prev };

        delete next.location;

        return next;
      });

      if (onLocationDetected) {

        onLocationDetected({
          lat,
          lng,
          address: displayName,
        });

      }

    } catch (error) {

      console.error(
        "Reverse geocoding error:",
        error
      );

      const fallbackLocation =
        `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

      setLocation(fallbackLocation);

      if (onLocationDetected) {

        onLocationDetected({
          lat,
          lng,
          address: fallbackLocation,
        });

      }

    } finally {

      setGeoLocating(false);

    }

  };


  // ============================================================
  // HANDLE GEOLOCATION RESPONSE
  // ============================================================

  useEffect(() => {

    if (!geoLocating) {
      return;
    }

    if (coords) {

      reverseGeocode(
        coords.lat,
        coords.lng
      );

    }

    if (geoError) {

      setGeoLocating(false);

      setGeoAlert(
        geoError ||
        "Unable to detect your location."
      );

    }

  }, [coords, geoError, geoLocating]);


  // ============================================================
  // USE MY LOCATION
  // ============================================================

  const handleUseMyLocation = () => {

    if (loading || geoLocating) {
      return;
    }

    setGeoLocating(true);

    setGeoAlert(null);

    getGeoLocation();

  };


  // ============================================================
  // IMAGE PREVIEWS
  // ============================================================

  useEffect(() => {

    if (!images || images.length === 0) {

      setPreviewUrls([]);

      return;
    }

    const urls = images.map((image) =>
      URL.createObjectURL(image)
    );

    setPreviewUrls(urls);

    return () => {

      urls.forEach((url) =>
        URL.revokeObjectURL(url)
      );

    };

  }, [images]);


  // ============================================================
  // STOP CAMERA
  // ============================================================

  const stopCamera = () => {

    if (streamRef.current) {

      streamRef.current
        .getTracks()
        .forEach((track) =>
          track.stop()
        );

      streamRef.current = null;

    }

    if (videoRef.current) {

      videoRef.current.srcObject = null;

    }

  };


  // ============================================================
  // CLEAN CAMERA ON UNMOUNT
  // ============================================================

  useEffect(() => {

    return () => {
      stopCamera();
    };

  }, []);


  // ============================================================
  // VALIDATE FILE
  // ============================================================

  const validateFile = (file) => {

    if (!file) {
      return "Invalid image file.";
    }

    if (
      !file.type ||
      !file.type.startsWith("image/")
    ) {
      return "Only image files are allowed.";
    }

    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {

      return `${file.name} has an unsupported format. Use JPG, PNG, or WEBP.`;

    }

    const maxSize =
      10 * 1024 * 1024;

    if (file.size > maxSize) {

      return `${file.name} exceeds the 10 MB size limit.`;

    }

    if (file.size === 0) {

      return `${file.name} is empty or corrupted.`;

    }

    return null;

  };


  // ============================================================
  // ADD IMAGES
  // ============================================================

  const handleFiles = (fileList) => {

    if (!fileList) {
      return;
    }

    const selectedFiles =
      Array.from(fileList);

    const validFiles = [];

    const fileErrors = [];


    selectedFiles.forEach((file) => {

      const error =
        validateFile(file);

      if (error) {

        fileErrors.push(error);

      } else {

        validFiles.push(file);

      }

    });


    if (fileErrors.length > 0) {

      setErrors((prev) => ({

        ...prev,

        image: fileErrors.join(" "),

      }));

    } else {

      setErrors((prev) => {

        const next = { ...prev };

        delete next.image;

        return next;

      });

    }


    if (validFiles.length > 0) {

      setImages((previousImages) => {

        const combined = [
          ...previousImages,
          ...validFiles,
        ];

        return combined.slice(0, 5);

      });

    }

  };


  // ============================================================
  // START CAMERA
  // ============================================================

  const startCamera = async () => {

    if (loading) {
      return;
    }

    setCameraError(null);

    setCameraOpen(true);

    try {

      const mediaStream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
          },

          audio: false,
        });

      streamRef.current = mediaStream;

      if (videoRef.current) {

        videoRef.current.srcObject =
          mediaStream;

      }

    } catch (err) {

      console.error(
        "Camera error:",
        err
      );

      setCameraError(
        "Camera permission denied or camera unavailable."
      );

    }

  };


  // ============================================================
  // CLOSE CAMERA
  // ============================================================

  const closeCamera = () => {

    stopCamera();

    setCameraOpen(false);

    setCameraError(null);

  };


  // ============================================================
  // CAPTURE IMAGE
  // ============================================================

  const captureImage = () => {

    if (
      !videoRef.current ||
      !canvasRef.current
    ) {
      return;
    }

    const video = videoRef.current;

    const canvas = canvasRef.current;

    canvas.width =
      video.videoWidth || 640;

    canvas.height =
      video.videoHeight || 480;

    const context =
      canvas.getContext("2d");

    context.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );

    canvas.toBlob(
      (blob) => {

        if (!blob) {
          return;
        }

        const file = new File(
          [blob],
          `camera_capture_${Date.now()}.jpg`,
          {
            type: "image/jpeg",
          }
        );

        handleFiles([file]);

        closeCamera();

      },
      "image/jpeg",
      0.9
    );

  };


  // ============================================================
  // BROWSE IMAGES
  // ============================================================

  const handleBrowseImages = () => {

    if (loading) {
      return;
    }

    if (fileInputRef.current) {

      fileInputRef.current.click();

    }

  };


  // ============================================================
  // DRAG & DROP HANDLERS
  // ============================================================

  const handleDragOver = (event) => {

    event.preventDefault();

    event.stopPropagation();

    if (loading) {
      return;
    }

    setIsDragging(true);

  };


  const handleDragLeave = (event) => {

    event.preventDefault();

    event.stopPropagation();

    setIsDragging(false);

  };


  const handleDrop = (event) => {

    event.preventDefault();

    event.stopPropagation();

    setIsDragging(false);

    if (loading) {
      return;
    }

    const droppedFiles =
      event.dataTransfer?.files;

    if (
      droppedFiles &&
      droppedFiles.length > 0
    ) {

      handleFiles(
        droppedFiles
      );

    }

  };


  // ============================================================
  // REMOVE IMAGE
  // ============================================================

  const handleRemoveImage = (indexToRemove) => {

    setImages(
      (previousImages) =>
        previousImages.filter(
          (_, index) =>
            index !== indexToRemove
        )
    );

  };


  // ============================================================
  // REMOVE ALL IMAGES
  // ============================================================

  const handleRemoveAllImages = () => {

    setImages([]);

    setErrors((prev) => {

      const next = {
        ...prev,
      };

      delete next.image;

      return next;

    });

    if (fileInputRef.current) {

      fileInputRef.current.value = "";

    }

  };


  // ============================================================
  // FORMAT FILE SIZE
  // ============================================================

  const formatFileSize = (bytes) => {

    if (!bytes) {
      return "0 B";
    }

    const kb = 1024;

    const sizes = [
      "B",
      "KB",
      "MB",
      "GB",
    ];

    const index =
      Math.floor(
        Math.log(bytes) /
        Math.log(kb)
      );

    return (
      parseFloat(
        (
          bytes /
          Math.pow(kb, index)
        ).toFixed(1)
      ) +
      " " +
      sizes[index]
    );

  };


  // ============================================================
  // SUBMIT
  // ============================================================

  const handleSubmit = (event) => {

    event.preventDefault();

    const newErrors = {};

    const trimmedLocation = location.trim();
    const trimmedDescription = description.trim();

    if (!trimmedLocation) {
      newErrors.location = "Please enter the incident location.";
    }

    if (!images || images.length === 0) {
      newErrors.image = "Please upload or capture at least one incident image as evidence.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});

    onAnalyze({
      location: trimmedLocation,
      description: trimmedDescription,
      images: images,
    });

  };


  // ============================================================
  // UI
  // ============================================================

  return (

    <div className="w-full max-w-4xl mx-auto my-6">

      {/* ====================================================== */}
      {/* CAMERA MODAL */}
      {/* ====================================================== */}

      {cameraOpen && (

        <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4">

          <div className="w-full max-w-2xl bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden animate-fade-in">

            <div className="flex items-center justify-between p-4 border-b border-gray-200">

              <div>

                <h3 className="text-base font-bold text-gray-900">
                  Capture Incident Evidence
                </h3>

                <p className="text-xs text-gray-500 mt-0.5">
                  Take a photograph to attach as evidence to the incident report.
                </p>

              </div>

              <button
                type="button"
                onClick={closeCamera}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
              >

                <FaTimes />

              </button>

            </div>

            <div className="p-4 bg-gray-50">

              {cameraError ? (

                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">

                  {cameraError}

                </div>

              ) : (

                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full max-h-[60vh] object-cover rounded-xl bg-black shadow-inner"
                />

              )}

              <canvas
                ref={canvasRef}
                className="hidden"
              />

            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-gray-200 bg-white">

              <button
                type="button"
                onClick={closeCamera}
                className="btn-secondary"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={captureImage}
                disabled={!!cameraError}
                className="btn-primary bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >

                <FaCamera />

                Capture Image

              </button>

            </div>

          </div>

        </div>

      )}


      {/* ====================================================== */}
      {/* HEADER CARD */}
      {/* ====================================================== */}

      <div className="bg-white border border-gray-200 rounded-t-2xl p-6 sm:p-8 shadow-xs border-b-0">

        <div className="flex items-start sm:items-center gap-4">

          <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 shrink-0">

            <FaExclamationCircle className="text-xl" />

          </div>

          <div>

            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">
                Report Disaster Incident
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 text-xs font-bold uppercase tracking-wider">
                Emergency Input
              </span>
            </div>

            <p className="text-sm text-gray-500 mt-1 leading-relaxed">
              Describe what is happening naturally. SwarmAI multi-agent intelligence will analyze the situation and coordinate emergency response.
            </p>

          </div>

        </div>

      </div>


      {/* ====================================================== */}
      {/* FORM BODY */}
      {/* ====================================================== */}

      <div className="bg-white border border-gray-200 rounded-b-2xl p-6 sm:p-8 shadow-sm">

        {/* API ERROR */}

        {apiError && (

          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex gap-3 animate-fade-in">

            <FaExclamationCircle className="mt-0.5 shrink-0 text-red-600" />

            <div>

              <p className="font-bold text-red-900">
                Analysis Failed
              </p>

              <p className="mt-0.5">
                {apiError}
              </p>

            </div>

          </div>

        )}


        <form
          onSubmit={handleSubmit}
          className="space-y-6"
          noValidate
        >

          {/* ================================================== */}
          {/* DESCRIPTION */}
          {/* ================================================== */}

          <div>

            <label className="block text-sm font-semibold text-gray-900 mb-2">

              Incident Description

              <span className="text-xs text-gray-400 font-normal ml-2">
                (Optional)
              </span>

            </label>

            <textarea
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                if (errors.description) {
                  setErrors((prev) => {
                    const next = { ...prev };
                    delete next.description;
                    return next;
                  });
                }
              }}
              disabled={loading}
              rows={4}
              placeholder="Large fire spreading near several houses. Severe smoke is blocking the main road..."
              className={`w-full px-4 py-3 rounded-xl bg-white border text-gray-900 text-sm placeholder:text-gray-400 outline-none transition duration-200 ${
                errors.description
                  ? "border-red-500 focus:ring-2 focus:ring-red-500/20"
                  : "border-gray-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/15"
              }`}
            />

            {errors.description && (
              <p className="text-xs text-red-600 flex items-center gap-1.5 pt-1.5">
                <FaExclamationCircle />
                {errors.description}
              </p>
            )}

          </div>


          {/* ================================================== */}
          {/* LOCATION */}
          {/* ================================================== */}

          <div className="space-y-2">

            <div className="flex items-center justify-between gap-3">

              <label
                htmlFor="disaster-location"
                className="text-sm font-semibold text-gray-900 flex items-center gap-1.5"
              >

                <FaMapMarkerAlt className="text-red-500 text-xs" />

                <span>
                  Location
                </span>

                <span className="text-xs text-red-600 font-normal">
                  * Required
                </span>

              </label>

              <button
                type="button"
                onClick={handleUseMyLocation}
                disabled={loading || geoLocating}
                className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1.5 bg-blue-50 border border-blue-200 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >

                {geoLocating ? (

                  <>
                    <FaSpinner className="animate-spin text-[10px]" />
                    <span>Locating...</span>
                  </>

                ) : (

                  <>
                    <FaMapMarkerAlt className="text-[10px]" />
                    <span>Use Current Location</span>
                  </>

                )}

              </button>

            </div>

            <input
              id="disaster-location"
              type="text"
              value={location}
              onChange={(event) => {

                setLocation(
                  event.target.value
                );

                if (errors.location) {

                  setErrors((prev) => {

                    const next = {
                      ...prev,
                    };

                    delete next.location;

                    return next;

                  });

                }

              }}
              disabled={loading}
              placeholder="e.g. Pune, Maharashtra"
              className={`w-full px-4 py-3 rounded-xl bg-white border text-gray-900 text-sm placeholder:text-gray-400 outline-none transition duration-200 ${
                errors.location
                  ? "border-red-500 focus:ring-2 focus:ring-red-500/20"
                  : "border-gray-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/15"
              } ${
                loading
                  ? "opacity-60 cursor-not-allowed"
                  : ""
              }`}
            />

            {errors.location && (

              <p className="text-xs text-red-600 flex items-center gap-1.5 pt-1">

                <FaExclamationCircle />

                {errors.location}

              </p>

            )}

            {geoAlert && (

              <p className="text-xs text-amber-600 flex items-center gap-1.5 pt-1">

                <FaExclamationCircle />

                {geoAlert}

              </p>

            )}

          </div>


          {/* ================================================== */}
          {/* HIDDEN FILE INPUT */}
          {/* ================================================== */}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(event) => {

              handleFiles(
                event.target.files
              );

              event.target.value = "";

            }}
          />


          {/* ================================================== */}
          {/* IMAGE UPLOAD ZONE */}
          {/* ================================================== */}

          <div>

            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">

              <label className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">

                <FaImages className="text-blue-600" />

                Incident Evidence Images

                <span className="text-red-600 font-bold">*</span>

              </label>

              <div className="flex items-center gap-2.5">

                <button
                  type="button"
                  onClick={handleBrowseImages}
                  disabled={loading}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
                >

                  <FaImages className="text-blue-600 text-xs" />

                  <span>Browse Images</span>

                </button>

                <button
                  type="button"
                  onClick={startCamera}
                  disabled={loading}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
                >

                  <FaCamera className="text-emerald-600 text-xs" />

                  <span>Use Camera</span>

                </button>

                <span className="text-xs text-gray-400 font-mono ml-1">

                  {images.length} / 5

                </span>

              </div>

            </div>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition duration-200 ${
                isDragging
                  ? "border-blue-500 bg-blue-50/50"
                  : errors.image
                  ? "border-red-400 bg-red-50/30"
                  : "border-gray-300 bg-gray-50/60 hover:bg-gray-50 hover:border-gray-400"
              }`}
            >

              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3 border border-blue-100 shadow-xs">
                <FaCloudUploadAlt className="text-xl" />
              </div>

              <p className="text-sm font-bold text-gray-900">

                Drag and drop disaster images here

              </p>

              <p className="text-xs text-gray-500 mt-1">

                JPG, PNG, WEBP • Maximum 10 MB per image

              </p>

              <div className="flex flex-col sm:flex-row justify-center gap-3 mt-4">

                <button
                  type="button"
                  onClick={handleBrowseImages}
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl bg-white border border-gray-300 hover:border-blue-500 hover:bg-blue-50/50 text-gray-800 text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >

                  <FaImages className="text-blue-600 text-sm" />

                  Browse Images

                </button>

                <button
                  type="button"
                  onClick={startCamera}
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl bg-white border border-gray-300 hover:border-emerald-500 hover:bg-emerald-50/50 text-gray-800 text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >

                  <FaCamera className="text-emerald-600 text-sm" />

                  Use Camera

                </button>

              </div>

            </div>

            {errors.image && (

              <p className="mt-2 text-xs text-red-600 font-medium flex items-center gap-1">
                <FaExclamationCircle />
                {errors.image}

              </p>

            )}


            {/* ================================================ */}
            {/* IMAGE PREVIEWS */}
            {/* ================================================ */}

            {images.length > 0 && (

              <div className="mt-5">

                <div className="flex justify-between items-center mb-3">

                  <p className="text-xs font-bold uppercase tracking-wider text-gray-600">

                    Attached Evidence ({images.length})

                  </p>

                  <button
                    type="button"
                    onClick={handleRemoveAllImages}
                    disabled={loading}
                    className="text-xs text-red-600 hover:text-red-700 font-semibold transition"
                  >

                    Remove All

                  </button>

                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">

                  {images.map(
                    (image, index) => (

                      <div
                        key={`${image.name}-${image.lastModified}-${index}`}
                        className="relative rounded-xl overflow-hidden border border-gray-200 bg-white shadow-xs group"
                      >

                        <img
                          src={previewUrls[index]}
                          alt={image.name}
                          className="w-full aspect-square object-cover"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            handleRemoveImage(index)
                          }
                          disabled={loading}
                          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-gray-900/70 hover:bg-red-600 text-white flex items-center justify-center transition shadow-sm"
                        >

                          <FaTrashAlt className="text-xs" />

                        </button>

                        <div className="p-2 bg-white border-t border-gray-100">

                          <p className="text-xs font-medium text-gray-900 truncate">

                            {image.name}

                          </p>

                          <p className="text-[10px] text-gray-400 font-mono mt-0.5">

                            {formatFileSize(
                              image.size
                            )}

                          </p>

                        </div>

                      </div>

                    )
                  )}

                </div>

              </div>

            )}

          </div>


          {/* ================================================== */}
          {/* SUBMIT BUTTON */}
          {/* ================================================== */}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold flex items-center justify-center gap-2.5 transition shadow-md shadow-blue-500/20 text-sm tracking-wide cursor-pointer"
          >

            {loading ? (

              <>
                <FaSpinner className="animate-spin text-base" />
                Analyzing Incident Intelligence...
              </>

            ) : (

              <>
                Analyze Incident Intelligence
                <FaArrowRight className="text-xs" />
              </>

            )}

          </button>

        </form>

      </div>

    </div>

  );

}