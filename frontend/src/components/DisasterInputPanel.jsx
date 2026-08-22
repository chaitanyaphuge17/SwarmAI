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


    // ==========================================================
    // HANDLE ERRORS
    // ==========================================================

    if (fileErrors.length > 0) {

      setErrors((prev) => ({
        ...prev,
        image: fileErrors.join(" "),
      }));

    } else {

      setErrors((prev) => {

        const next = {
          ...prev,
        };

        delete next.image;

        return next;

      });

    }


    // ==========================================================
    // ADD UNIQUE FILES
    // ==========================================================

    if (validFiles.length > 0) {

      setImages((previousImages) => {

        const uniqueFiles =
          validFiles.filter((newFile) => {

            return !previousImages.some(
              (existingFile) =>
                existingFile.name ===
                  newFile.name &&
                existingFile.size ===
                  newFile.size &&
                existingFile.lastModified ===
                  newFile.lastModified
            );

          });

        return [
          ...previousImages,
          ...uniqueFiles,
        ];

      });

    }

  };


  // ============================================================
  // BROWSE IMAGES
  // ============================================================

  const handleBrowseImages = () => {

    if (loading) {
      return;
    }

    fileInputRef.current?.click();

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

      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {

        throw new Error(
          "Camera access is not supported in this browser."
        );

      }


      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: {
              ideal: "environment",
            },
          },
          audio: false,
        });


      streamRef.current = stream;


      if (videoRef.current) {

        videoRef.current.srcObject =
          stream;

        await videoRef.current.play();

      }

    } catch (error) {

      console.error(
        "Camera error:",
        error
      );

      setCameraError(
        "Unable to access camera. Please allow camera permission and try again."
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
  // CAPTURE CAMERA IMAGE
  // ============================================================

  const captureImage = () => {

    const video =
      videoRef.current;

    const canvas =
      canvasRef.current;


    if (!video || !canvas) {

      setCameraError(
        "Camera is not ready."
      );

      return;

    }


    if (
      !video.videoWidth ||
      !video.videoHeight
    ) {

      setCameraError(
        "Camera is still loading. Please wait a moment."
      );

      return;

    }


    canvas.width =
      video.videoWidth;

    canvas.height =
      video.videoHeight;


    const context =
      canvas.getContext("2d");


    if (!context) {

      setCameraError(
        "Unable to process captured image."
      );

      return;

    }


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

          setCameraError(
            "Failed to capture image."
          );

          return;

        }


        const timestamp =
          Date.now();


        const capturedFile =
          new File(
            [blob],
            `camera_capture_${timestamp}.jpg`,
            {
              type: "image/jpeg",
              lastModified: timestamp,
            }
          );


        // Camera image is added to the
        // SAME images array as uploaded images.
        handleFiles([
          capturedFile,
        ]);


        closeCamera();

      },
      "image/jpeg",
      0.92
    );

  };


  // ============================================================
  // DRAG EVENTS
  // ============================================================

  const handleDragOver = (event) => {

    event.preventDefault();

    event.stopPropagation();

    if (!loading) {
      setIsDragging(true);
    }

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

  const handleRemoveImage =
    (indexToRemove) => {

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

    <div className="w-full max-w-5xl mx-auto">

      {/* ====================================================== */}
      {/* CAMERA MODAL */}
      {/* ====================================================== */}

      {cameraOpen && (

        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">

          <div className="w-full max-w-2xl bg-slate-950 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">

            <div className="flex items-center justify-between p-4 border-b border-slate-800">

              <div>

                <h3 className="text-lg font-bold text-white">
                  Capture Incident Evidence
                </h3>

                <p className="text-xs text-slate-400 mt-1">
                  Take a photograph and it will automatically be attached to the incident report.
                </p>

              </div>


              <button
                type="button"
                onClick={closeCamera}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >

                <FaTimes />

              </button>

            </div>


            <div className="p-4">

              {cameraError ? (

                <div className="p-4 rounded-xl bg-red-950/40 border border-red-800 text-red-300 text-sm">

                  {cameraError}

                </div>

              ) : (

                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full max-h-[65vh] object-cover rounded-xl bg-black"
                />

              )}


              <canvas
                ref={canvasRef}
                className="hidden"
              />

            </div>


            <div className="flex justify-end gap-3 p-4 border-t border-slate-800">

              <button
                type="button"
                onClick={closeCamera}
                className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-semibold"
              >
                Cancel
              </button>


              <button
                type="button"
                onClick={captureImage}
                disabled={!!cameraError}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-bold flex items-center gap-2"
              >

                <FaCamera />

                Capture Image

              </button>

            </div>

          </div>

        </div>

      )}


      {/* ====================================================== */}
      {/* HEADER */}
      {/* ====================================================== */}

      <div className="bg-slate-900 border border-slate-800 rounded-t-2xl p-6 sm:p-8">

        <div className="flex items-center gap-3">

          <div className="p-3 rounded-xl bg-red-600/10 border border-red-500/30 text-red-400">

            <FaExclamationCircle />

          </div>


          <div>

            <h2 className="text-2xl font-bold text-white uppercase tracking-tight">
              Report An Incident
            </h2>

            <p className="text-sm text-slate-400 mt-1">
              Describe what is happening naturally. SwarmAI multi-agent intelligence will analyze the situation and coordinate emergency response.
            </p>

          </div>

        </div>

      </div>


      {/* ====================================================== */}
      {/* FORM */}
      {/* ====================================================== */}

      <div className="bg-slate-950 border-x border-b border-slate-800 rounded-b-2xl p-6 sm:p-8">


        {/* API ERROR */}

        {apiError && (

          <div className="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-800 text-red-300 text-sm flex gap-3">

            <FaExclamationCircle className="mt-0.5 shrink-0" />

            <div>

              <p className="font-bold">
                Analysis Failed
              </p>

              <p className="mt-1">
                {apiError}
              </p>

            </div>

          </div>

        )}


        <form
          onSubmit={handleSubmit}
          className="space-y-7"
          noValidate
        >


          {/* ================================================== */}
          {/* DESCRIPTION (NATURAL LANGUAGE INCIDENT REPORTING) */}
          {/* ================================================== */}

          <div>

            <label className="block text-sm font-semibold text-slate-200 mb-2">

              Describe what is happening

              <span className="text-xs text-slate-400 font-normal ml-2">
                Optional
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
              className={`w-full px-4 py-3.5 rounded-xl bg-slate-900 border text-white placeholder:text-slate-500 outline-none focus:ring-2 resize-none transition duration-200 ${
                errors.description
                  ? "border-red-500 focus:ring-red-500/50"
                  : "border-slate-800 focus:border-slate-600 focus:ring-slate-700/50"
              }`}
            />

            {errors.description && (
              <p className="text-xs text-red-400 flex items-center gap-1.5 pt-1.5">
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
                className="text-sm font-semibold text-slate-200 flex items-center gap-2"
              >

                <FaMapMarkerAlt className="text-red-500 text-xs" />

                <span>
                  Location
                </span>

                <span className="text-xs text-red-400 font-normal">
                  * Required
                </span>

              </label>


              <button
                type="button"
                onClick={handleUseMyLocation}
                disabled={loading || geoLocating}
                className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 bg-blue-950/40 border border-blue-800/50 hover:bg-blue-900/30 px-2.5 py-1.5 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >

                {geoLocating ? (

                  <>
                    <FaSpinner className="animate-spin text-[10px]" />
                    <span>Locating...</span>
                  </>

                ) : (

                  <>
                    <FaMapMarkerAlt className="text-[10px]" />
                    <span>Use current location</span>
                  </>

                )}

              </button>

            </div>


            <p className="text-xs text-slate-400">
              City, district, landmark, or street address.
            </p>


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
              className={`w-full px-4 py-3.5 rounded-xl bg-slate-900 border text-slate-100 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 transition duration-200 ${
                errors.location
                  ? "border-red-500 focus:ring-red-500/50"
                  : "border-slate-800 focus:border-slate-600 focus:ring-slate-700/50"
              } ${
                loading
                  ? "opacity-60 cursor-not-allowed"
                  : ""
              }`}
            />


            {errors.location && (

              <p className="text-xs text-red-400 flex items-center gap-1.5 pt-1">

                <FaExclamationCircle />

                {errors.location}

              </p>

            )}


            {geoAlert && (

              <p className="text-xs text-amber-400 flex items-center gap-1.5 pt-1">

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
          {/* IMAGE UPLOAD */}
          {/* ================================================== */}

          <div>

            <div className="flex items-center justify-between gap-4 mb-3">

              <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">

                <FaImages className="text-red-500" />

                Incident Images

                <span className="text-red-400">
                  *
                </span>

              </label>


              <span className="text-xs text-slate-500">

                {images.length} selected

              </span>

            </div>


            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition ${
                isDragging
                  ? "border-red-500 bg-red-950/20"
                  : errors.image
                  ? "border-red-700 bg-red-950/10"
                  : "border-slate-700 bg-slate-900/50"
              }`}
            >

              <FaCloudUploadAlt className="mx-auto text-3xl text-slate-400 mb-3" />


              <p className="text-sm font-semibold text-slate-200">

                Drag and drop disaster images here

              </p>


              <p className="text-xs text-slate-500 mt-2">

                JPG, PNG, WEBP • Maximum 10 MB per image

              </p>


              <div className="flex flex-col sm:flex-row justify-center gap-3 mt-5">


                <button
                  type="button"
                  onClick={handleBrowseImages}
                  disabled={loading}
                  className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-sm font-semibold flex items-center justify-center gap-2"
                >

                  <FaImages />

                  Browse Images

                </button>


                <button
                  type="button"
                  onClick={startCamera}
                  disabled={loading}
                  className="px-5 py-3 rounded-xl bg-red-600/10 hover:bg-red-600/20 border border-red-500/40 text-red-300 text-sm font-semibold flex items-center justify-center gap-2"
                >

                  <FaCamera />

                  Use Camera

                </button>

              </div>

            </div>


            {errors.image && (

              <p className="mt-2 text-xs text-red-400">

                {errors.image}

              </p>

            )}


            {/* ================================================ */}
            {/* IMAGE PREVIEWS */}
            {/* ================================================ */}

            {images.length > 0 && (

              <div className="mt-6">

                <div className="flex justify-between items-center mb-3">

                  <p className="text-sm font-semibold text-slate-300">

                    Selected Images

                  </p>


                  <button
                    type="button"
                    onClick={handleRemoveAllImages}
                    disabled={loading}
                    className="text-xs text-red-400 hover:text-red-300"
                  >

                    Remove All

                  </button>

                </div>


                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">

                  {images.map(
                    (image, index) => (

                      <div
                        key={`${image.name}-${image.lastModified}-${index}`}
                        className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-900"
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
                          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/70 hover:bg-red-600 text-white flex items-center justify-center"
                        >

                          <FaTrashAlt />

                        </button>


                        <div className="p-2">

                          <p className="text-xs text-slate-300 truncate">

                            {image.name}

                          </p>

                          <p className="text-[10px] text-slate-500 mt-1">

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
          {/* SUBMIT */}
          {/* ================================================== */}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold flex items-center justify-center gap-3 transition"
          >

            {loading ? (

              <>
                <FaSpinner className="animate-spin" />
                Analyzing Disaster...
              </>

            ) : (

              <>
                Analyze Incident
                <FaArrowRight />
              </>

            )}

          </button>

        </form>

      </div>

    </div>

  );

}