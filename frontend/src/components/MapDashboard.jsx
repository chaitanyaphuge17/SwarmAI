import {
  useEffect,
  useRef,
  useState,
} from "react";

import maplibregl from "maplibre-gl";

import "maplibre-gl/dist/maplibre-gl.css";


export default function MapDashboard({
  data,
}) {

  const mapContainer =
    useRef(null);

  const mapRef =
    useRef(null);

  const ambulanceRef =
    useRef(null);

  const vehicleMarkersRef =
    useRef([]);

  const animationRef =
    useRef(null);

  const markersRef =
    useRef([]);

  const facilityMarkersRef =
    useRef([]);

  const agentMarkersRef =
    useRef([]);

  const mapLoadedRef =
    useRef(false);

  const [mapReady, setMapReady] =
    useState(false);

  const [facilityFilter, setFacilityFilter] =
    useState("all");


  const [
    ,
    setRouteInfo,
  ] = useState({

    status:
      "Waiting for simulation",

    route:
      [],

    facility:
      null,

    vehicle:
      "ambulance"
  });


  const MAPTILER_KEY =
    import.meta.env
      .VITE_MAPTILER_KEY;


  // =========================================================
  // INITIALIZE MAP
  // =========================================================

  useEffect(() => {

    if (
      mapRef.current
    ) {

      return;
    }


    const styleUrl = MAPTILER_KEY
      ? `https://api.maptiler.com/maps/dataviz-light/style.json?key=${MAPTILER_KEY}`
      : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: styleUrl,
      center: [73.8567, 18.5204],
      zoom: 11,
    });

    mapRef.current = map;

    map.addControl(
      new maplibregl.NavigationControl(),
      "top-right"
    );

    map.on("load", () => {
      mapLoadedRef.current = true;
      setMapReady(true);
      console.log("Map loaded successfully");
    });


    return () => {

      if (
        animationRef.current
      ) {

        clearInterval(
          animationRef.current
        );

      }


      markersRef.current.forEach(
        marker => marker.remove()
      );

      facilityMarkersRef.current.forEach(
        marker => marker.remove()
      );


      markersRef.current =
        [];

      facilityMarkersRef.current.forEach(
        marker => marker.remove()
      );

      facilityMarkersRef.current =
        [];

      agentMarkersRef.current.forEach(
        marker => marker.remove()
      );

      agentMarkersRef.current =
        [];


      if (
        ambulanceRef.current
      ) {

        ambulanceRef.current.remove();

        ambulanceRef.current =
          null;

      }

      vehicleMarkersRef.current.forEach(
        marker => marker.remove()
      );

      vehicleMarkersRef.current = [];

      vehicleMarkersRef.current.forEach(
        marker => marker.remove()
      );

      vehicleMarkersRef.current = [];


      map.remove();

      mapRef.current =
        null;

      mapLoadedRef.current =
        false;

      setMapReady(false);

    };

  }, []);


  // =========================================================
  // GET MAP COORDINATES
  // =========================================================

  const getScenarioCoordinates =
    () => {

      const latitude =
        Number(

          data?.map?.latitude ??

          data?.scenario?.latitude ??

          data?.event?.latitude ??

          data?.event?.lat

        );


      const longitude =
        Number(

          data?.map?.longitude ??

          data?.scenario?.longitude ??

          data?.event?.longitude ??

          data?.event?.lng

        );


      if (

        !Number.isFinite(
          latitude
        )

        ||

        !Number.isFinite(
          longitude
        )

      ) {

        return null;

      }


      return {

        lat:
          latitude,

        lng:
          longitude

      };

    };


  // =========================================================
  // GET ROUTE COORDINATES
  // =========================================================

  const getRouteCoordinates =
    () => {

      const coordinates =

        data?.map?.coordinates ||

        data?.traffic_response
          ?.route_coordinates ||

        [];


      if (

        !Array.isArray(
          coordinates
        )

      ) {

        return [];

      }


      return coordinates.filter(
        point =>

          Number.isFinite(
            Number(
              point?.lat
            )
          )

          &&

          Number.isFinite(
            Number(
              point?.lng
            )
          )

      );

    };

  const normalizeFacilityType = (typeStr) => {
    const s = String(typeStr || "").toLowerCase();
    if (s.includes("hospital") || s.includes("medical") || s.includes("clinic") || s.includes("health")) {
      return "hospital";
    }
    if (s.includes("fire") || s.includes("station")) {
      return "fire_station";
    }
    if (s.includes("shelter") || s.includes("camp") || s.includes("relief") || s.includes("hall")) {
      return "shelter";
    }
    return "hospital";
  };

  const getNearbyFacilities = () => {
    const rawFacilities = [
      ...(Array.isArray(data?.map?.facilities) ? data.map.facilities : []),
      ...(Array.isArray(data?.traffic_response?.nearby_facilities) ? data.traffic_response.nearby_facilities : []),
      ...(Array.isArray(data?.agents?.TrafficAgent?.traffic_response?.nearby_facilities) ? data.agents.TrafficAgent.traffic_response.nearby_facilities : []),
      ...(Array.isArray(data?.agents?.MedicalAgent?.decision?.nearby_facilities) ? data.agents.MedicalAgent.decision.nearby_facilities : []),
      ...(Array.isArray(data?.agents?.MedicalAgent?.nearby_facilities) ? data.agents.MedicalAgent.nearby_facilities : []),
      ...(Array.isArray(data?.agents?.ResourceAgent?.decision?.nearby_facilities) ? data.agents.ResourceAgent.decision.nearby_facilities : []),
      ...(Array.isArray(data?.agents?.ResourceAgent?.nearby_facilities) ? data.agents.ResourceAgent.nearby_facilities : []),
      ...(Array.isArray(data?.agents?.EmergencyAgent?.decision?.nearby_facilities) ? data.agents.EmergencyAgent.decision.nearby_facilities : []),
    ];

    const unique = [];
    const seen = new Set();
    for (const f of rawFacilities) {
      if (!f) continue;
      const lat = Number(f.lat);
      const lng = Number(f.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const key = `${lat.toFixed(4)}_${lng.toFixed(4)}_${f.name || f.type}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push({ ...f, lat, lng, normType: normalizeFacilityType(f.type) });
      }
    }

    return unique.filter(facility => {
      if (facilityFilter === "all") return true;
      return facility.normType === facilityFilter || facility.type === facilityFilter;
    });
  };

  const getSwarmAgentNodes = () => {
    const coords = getScenarioCoordinates();
    if (!coords) return [];

    const baseLat = coords.lat;
    const baseLng = coords.lng;

    const agents = data?.agents || {};

    const coordinator = agents.CoordinatorAgent || {};
    const medical = agents.MedicalAgent || {};
    const resource = agents.ResourceAgent || {};
    const emergency = agents.EmergencyAgent || {};
    const traffic = agents.TrafficAgent || {};

    return [
      {
        id: "CoordinatorAgent",
        name: "CoordinatorAgent (Command HQ)",
        icon: "🎯",
        badge: "Coordinator HQ",
        color: "#8b5cf6",
        type: "coordinator",
        lat: Number(coordinator.decision?.command_center?.lat) || baseLat + 0.005,
        lng: Number(coordinator.decision?.command_center?.lng) || baseLng - 0.006,
        status: "Master Command Active",
        role: "Emergency Coordinator & Swarm Orchestration",
        recommendation: coordinator.decision?.recommendation || coordinator.decision?.action || "Synchronizing emergency response, medical triage, and supply logistics.",
      },
      {
        id: "MedicalAgent",
        name: "MedicalAgent (Field Triage)",
        icon: "🩺",
        badge: "Medical Triage",
        color: "#0d9488",
        type: "medical",
        lat: Number(medical.decision?.triage_center?.lat) || Number(medical.decision?.nearby_facilities?.[0]?.lat) || baseLat + 0.004,
        lng: Number(medical.decision?.triage_center?.lng) || Number(medical.decision?.nearby_facilities?.[0]?.lng) || baseLng + 0.006,
        status: "Triage Operational",
        role: "Medical Triage & Field Hospital",
        recommendation: medical.decision?.recommendation || medical.decision?.action || "Establishing field hospital and allocating emergency beds.",
      },
      {
        id: "ResourceAgent",
        name: "ResourceAgent (Supply Staging)",
        icon: "📦",
        badge: "Supply Depot",
        color: "#f59e0b",
        type: "resource",
        lat: Number(resource.decision?.staging_area?.lat) || Number(resource.decision?.nearby_facilities?.[0]?.lat) || baseLat - 0.006,
        lng: Number(resource.decision?.staging_area?.lng) || Number(resource.decision?.nearby_facilities?.[0]?.lng) || baseLng - 0.007,
        status: "Supplies Mobilized",
        role: "Supply & Logistics Staging Depot",
        recommendation: resource.decision?.recommendation || resource.decision?.action || "Ration kits, emergency generators, and water supply staged.",
      },
      {
        id: "EmergencyAgent",
        name: "EmergencyAgent (Ops Post)",
        icon: "🚨",
        badge: "Emergency Ops",
        color: "#ef4444",
        type: "emergency",
        lat: baseLat - 0.005,
        lng: baseLng + 0.005,
        status: "Hazard Command Active",
        role: "Rapid Hazard Assessment & Rescue Command",
        recommendation: emergency.decision?.recommendation || emergency.decision?.action || "Disaster hazard perimeter secured. Rescue crews deployed.",
      },
      {
        id: "TrafficAgent",
        name: "TrafficAgent (Routing Post)",
        icon: "🚦",
        badge: "Traffic Control",
        color: "#2563eb",
        type: "traffic",
        lat: baseLat + 0.002,
        lng: baseLng - 0.009,
        status: "Corridor Managed",
        role: "Traffic Advisory & Evacuation Routing",
        recommendation: traffic.decision?.recommendation || traffic.decision?.action || "Emergency green corridor maintained for priority transport.",
      },
    ];
  };

  // Re-render facility & agent markers whenever facilityFilter, data, or mapReady changes
  useEffect(() => {
    if (!mapRef.current || !mapLoadedRef.current) return;
    addFacilityMarkers(getNearbyFacilities());
    const agentNodes = getSwarmAgentNodes();
    addAgentMarkers(agentNodes);
    addSwarmNetworkLines(agentNodes);
  }, [facilityFilter, data, mapReady]);


  // =========================================================
  // UPDATE MAP
  // =========================================================

  useEffect(() => {

    const map =
      mapRef.current;


    if (
      !map
      ||
      !mapLoadedRef.current
      ||
      !data
    ) {

      return;

    }


    const coordinates =
      getScenarioCoordinates();


    const routeCoordinates =
      getRouteCoordinates();


    // -------------------------------------------------------
    // CENTER ON DISASTER
    // -------------------------------------------------------

    if (
      coordinates
    ) {

      map.flyTo({

        center: [

          coordinates.lng,

          coordinates.lat

        ],

        zoom:
          12,

        duration:
          1200,

        essential:
          true

      });

    }


    // -------------------------------------------------------
    // ROUTE
    // -------------------------------------------------------

    if (

      routeCoordinates.length >= 2

    ) {

      fetchRealRoute(
        routeCoordinates
      );

    }

  }, [
    data,
    mapReady
  ]);


  // =========================================================
  // FETCH REAL ROUTE
  // =========================================================

  const fetchRealRoute =
    async (
      coords
    ) => {

      const routeEndpoints = [
        coords[0],
        coords[coords.length - 1],
      ];

      try {
        const formatted =
          routeEndpoints.map(
            point => [

              Number(
                point.lng
              ),

              Number(
                point.lat
              )

            ]
          );


        const backendUrl =

          import.meta.env
            .VITE_BACKEND_URL

          ||

          "http://127.0.0.1:8000";


        const response =
          await fetch(

            `${backendUrl}/route`,

            {

              method:
                "POST",

              headers: {

                "Content-Type":
                  "application/json"

              },

              body:
                JSON.stringify({

                  coordinates:
                    formatted

                })

            }

          );


        if (
          !response.ok
        ) {

          throw new Error(
            "Route API failed"
          );

        }


        const geojson =
          await response.json();


        if (

          !geojson?.features

          ||

          !geojson.features[0]

        ) {

          drawFallbackRoute(
            routeEndpoints
          );

          return;

        }


        drawRoute(

          geojson,

          routeEndpoints

        );

      }

      catch (
        error
      ) {

        console.warn(

          "Route API unavailable. Using fallback route.",

          error

        );


        drawFallbackRoute(
          routeEndpoints
        );

      }

    };


  // =========================================================
  // CLEAR MAP
  // =========================================================

  const clearMapLayers =
    () => {

      const map =
        mapRef.current;


      if (
        !map
      ) {

        return;

      }


      [

        "route-line",

        "route-glow",

        "danger-zone-fill",

        "danger-zone-border"

      ].forEach(
        layer => {

          if (
            map.getLayer(
              layer
            )
          ) {

            map.removeLayer(
              layer
            );

          }

        }
      );


      [

        "route",

        "danger-zone"

      ].forEach(
        source => {

          if (
            map.getSource(
              source
            )
          ) {

            map.removeSource(
              source
            );

          }

        }
      );


      markersRef.current.forEach(
        marker => {

          marker.remove();

        }
      );


      markersRef.current =
        [];


      if (
        ambulanceRef.current
      ) {

        ambulanceRef.current.remove();

        ambulanceRef.current =
          null;

      }

      vehicleMarkersRef.current.forEach(
        marker => marker.remove()
      );

      vehicleMarkersRef.current = [];


      if (
        animationRef.current
      ) {

        clearInterval(
          animationRef.current
        );

        animationRef.current =
          null;

      }

    };


  // =========================================================
  // FALLBACK ROUTE
  // =========================================================

  const drawFallbackRoute =
    (
      coords
    ) => {

      const fallbackGeojson = {

        type:
          "FeatureCollection",

        features: [

          {

            type:
              "Feature",

            properties:
              {},

            geometry: {

              type:
                "LineString",

              coordinates:

                coords.map(
                  point => [

                    Number(
                      point.lng
                    ),

                    Number(
                      point.lat
                    )

                  ]
                )

            }

          }

        ]

      };


      drawRoute(

        fallbackGeojson,

        coords

      );

    };


  // =========================================================
  // DRAW ROUTE
  // =========================================================

  const drawRoute =
    (
      geojson,
      coords
    ) => {

      const map =
        mapRef.current;


      if (
        !map
      ) {

        return;

      }


      clearMapLayers();


      const routeCoords =

        geojson
          ?.features?.[0]
          ?.geometry
          ?.coordinates

        ||

        [];


      const disasterPoint =

        coords[
          coords.length - 1
        ];


      if (
        disasterPoint
      ) {

        addDangerZone(
          disasterPoint
        );

      }


      // -----------------------------------------------------
      // ROUTE SOURCE
      // -----------------------------------------------------

      map.addSource(

        "route",

        {

          type:
            "geojson",

          data:
            geojson

        }

      );


      // -----------------------------------------------------
      // ROUTE GLOW
      // -----------------------------------------------------

      map.addLayer({

        id:
          "route-glow",

        type:
          "line",

        source:
          "route",

        layout: {

          "line-cap":
            "round",

          "line-join":
            "round"

        },

        paint: {

          "line-color":
            "#ef4444",

          "line-width":
            16,

          "line-opacity":
            0.2

        }

      });


      // -----------------------------------------------------
      // MAIN ROUTE
      // -----------------------------------------------------

      map.addLayer({

        id:
          "route-line",

        type:
          "line",

        source:
          "route",

        layout: {

          "line-cap":
            "round",

          "line-join":
            "round"

        },

        paint: {

          "line-color":
            "#ff3b30",

          "line-width":
            6,

          "line-opacity":
            0.95

        }

      });


      addMarkers(
        coords
      );

      addFacilityMarkers(
        getNearbyFacilities()
      );

      const swarmNodes = getSwarmAgentNodes();
      addAgentMarkers(swarmNodes);
      addSwarmNetworkLines(swarmNodes);


      fitToRoute(
        routeCoords
      );


      animateEmergencyVehicle(
        routeCoords
      );


      const trafficData =

        data?.agents
          ?.TrafficAgent

        ||

        data?.traffic_response

        ||

        {};


      setRouteInfo({

        status:

          trafficData
            ?.route_status

          ||

          "Emergency Route Active",


        route:

          coords.map(
            point =>
              point.zone ||
              "Route Point"
          ),


        facility:

          trafficData
            ?.selected_facility

          ||

          coords[0]

          ||

          null,


        vehicle:

          trafficData
            ?.vehicle_type

          ||

          "ambulance"

      });

    };


  // =========================================================
  // DANGER ZONE
  // =========================================================

  const addDangerZone =
    (
      point
    ) => {

      const map =
        mapRef.current;


      if (
        !point
        ||
        !map
      ) {

        return;

      }


      const lng =
        Number(
          point.lng
        );

      const lat =
        Number(
          point.lat
        );


      if (

        !Number.isFinite(
          lng
        )

        ||

        !Number.isFinite(
          lat
        )

      ) {

        return;

      }


      const severity =
        Number(

          data?.scenario?.severity ??

          data?.event?.severity ??

          5

        );


      // Larger disaster = larger danger zone

      const size =

        Math.min(

          0.04,

          Math.max(

            0.008,

            severity * 0.003

          )

        );


      const polygon = {

        type:
          "FeatureCollection",

        features: [

          {

            type:
              "Feature",

            properties:
              {},

            geometry: {

              type:
                "Polygon",

              coordinates: [[

                [

                  lng - size,

                  lat + size

                ],

                [

                  lng + size,

                  lat + size

                ],

                [

                  lng + size,

                  lat - size

                ],

                [

                  lng - size,

                  lat - size

                ],

                [

                  lng - size,

                  lat + size

                ]

              ]]

            }

          }

        ]

      };


      map.addSource(

        "danger-zone",

        {

          type:
            "geojson",

          data:
            polygon

        }

      );


      map.addLayer({

        id:
          "danger-zone-fill",

        type:
          "fill",

        source:
          "danger-zone",

        paint: {

          "fill-color":
            "#ef4444",

          "fill-opacity":
            0.22

        }

      });


      map.addLayer({

        id:
          "danger-zone-border",

        type:
          "line",

        source:
          "danger-zone",

        paint: {

          "line-color":
            "#ef4444",

          "line-width":
            3,

          "line-opacity":
            0.9

        }

      });

    };


  // =========================================================
  // ADD MARKERS
  // =========================================================

  const addMarkers =
    (
      coords
    ) => {

      coords.forEach(

        (
          point,
          index
        ) => {

          const marker =
            document.createElement(
              "div"
            );


          marker.className =
            "custom-map-marker";


          const isStart =
            index === 0;


          const isEnd =
            index ===
            coords.length - 1;


          const type =
            String(
              point.type ||
              ""
            ).toLowerCase();


          // -------------------------------------------------
          // ICON
          // -------------------------------------------------

          let icon =
            "📍";


          if (

            type === "hospital"

            ||

            type === "medical"

          ) {

            icon =
              "🏥";

          }

          else if (

            type === "fire_station"

          ) {

            icon =
              "🚒";

          }

          else if (

            type === "shelter"

          ) {

            icon =
              "🏠";

          }

          else if (

            isEnd

            ||

            type === "disaster"

          ) {

            icon =
              "🚨";

          }

          else if (

            type === "checkpoint"

          ) {

            icon =
              "🛣️";

          }


          marker.innerHTML =
            icon;


          marker.style.width =
            isEnd
              ? "46px"
              : "42px";


          marker.style.height =
            isEnd
              ? "46px"
              : "42px";


          marker.style.borderRadius =
            "50%";


          marker.style.display =
            "flex";


          marker.style.alignItems =
            "center";


          marker.style.justifyContent =
            "center";


          marker.style.fontSize =
            "22px";


          marker.style.border =
            "3px solid white";


          marker.style.cursor =
            "pointer";


          marker.style.background =

            isEnd

              ? "#dc2626"

              : isStart

                ? "#2563eb"

                : "#0891b2";


          marker.style.boxShadow =

            isEnd

              ? "0 0 35px rgba(239,68,68,1)"

              : "0 0 22px rgba(56,189,248,0.9)";


          const popup =
            new maplibregl.Popup({

              offset:
                20

            }).setHTML(`

              <div style="
                min-width:180px;
                font-family:Arial;
                color:#111;
                padding:6px;
              ">

                <strong>
                  ${point.zone || "Emergency Point"}
                </strong>

                <br/>

                <span style="
                  font-size:12px;
                  color:#555;
                ">

                  ${type || "route"}

                </span>

              </div>

            `);


          const mapMarker =
            new maplibregl.Marker({

              element:
                marker

            })

              .setLngLat([

                Number(
                  point.lng
                ),

                Number(
                  point.lat
                )

              ])

              .setPopup(
                popup
              )

              .addTo(
                mapRef.current
              );


          markersRef.current.push(
            mapMarker
          );

        }

      );

    };

  const addFacilityMarkers = (facilities) => {
    const map = mapRef.current;
    if (!map) return;

    facilityMarkersRef.current.forEach(marker => marker.remove());
    facilityMarkersRef.current = [];

    facilities.forEach(facility => {
      const normType = facility.normType || normalizeFacilityType(facility.type);
      const isFire = normType === "fire_station";
      const isShelter = normType === "shelter";

      const element = document.createElement("div");
      element.className = "custom-map-marker";
      element.textContent = isFire ? "🚒" : isShelter ? "🏠" : "🏥";
      element.style.width = "38px";
      element.style.height = "38px";
      element.style.display = "flex";
      element.style.alignItems = "center";
      element.style.justifyContent = "center";
      element.style.fontSize = "20px";
      element.style.border = "2px solid white";
      element.style.borderRadius = "50%";
      element.style.background = isFire ? "#f97316" : isShelter ? "#16a34a" : "#2563eb";
      element.style.boxShadow = "0 0 18px rgba(255,255,255,0.75)";
      element.style.cursor = "pointer";

      const popupHtml = `
        <div style="font-family: sans-serif; padding: 4px; min-width: 140px;">
          <strong style="font-size: 13px; color: #0f172a;">${facility.name || "Emergency Facility"}</strong>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px; text-transform: capitalize;">
            ${facility.type || (isFire ? "Fire Station" : isShelter ? "Shelter" : "Hospital")}
          </div>
        </div>
      `;

      const marker = new maplibregl.Marker({ element })
        .setLngLat([Number(facility.lng), Number(facility.lat)])
        .setPopup(new maplibregl.Popup({ offset: 18 }).setHTML(popupHtml))
        .addTo(map);

      facilityMarkersRef.current.push(marker);
    });
  };

  const addAgentMarkers = (nodes) => {
    const map = mapRef.current;
    if (!map) return;

    agentMarkersRef.current.forEach(marker => marker.remove());
    agentMarkersRef.current = [];

    const filteredNodes = nodes.filter(node => {
      if (facilityFilter === "all") return true;
      if (facilityFilter === "coordinator" && node.type === "coordinator") return true;
      if (facilityFilter === "medical" && (node.type === "medical" || node.type === "hospital")) return true;
      if (facilityFilter === "resource" && node.type === "resource") return true;
      if (facilityFilter === "hospital" && node.type === "medical") return true;
      if (facilityFilter === "fire_station" && (node.type === "emergency" || node.type === "fire_station")) return true;
      return false;
    });

    filteredNodes.forEach(node => {
      const element = document.createElement("div");
      element.className = "custom-agent-marker flex flex-col items-center cursor-pointer";

      element.innerHTML = `
        <div style="
          background: ${node.color};
          color: white;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          border: 3px solid white;
          box-shadow: 0 0 20px ${node.color};
          position: relative;
        ">
          ${node.icon}
          <span style="
            position: absolute;
            top: -3px;
            right: -3px;
            width: 12px;
            height: 12px;
            background: #22c55e;
            border: 2px solid white;
            border-radius: 50%;
          "></span>
        </div>
        <div style="
          background: rgba(15, 23, 42, 0.92);
          color: white;
          padding: 2px 8px;
          border-radius: 8px;
          font-size: 10px;
          font-weight: 800;
          white-space: nowrap;
          margin-top: 4px;
          border: 1px solid rgba(255, 255, 255, 0.25);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
        ">
          ${node.badge}
        </div>
      `;

      const popupHtml = `
        <div style="font-family: system-ui, -apple-system, sans-serif; padding: 6px; min-width: 220px; max-width: 280px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 6px;">
            <span style="font-size: 13px; font-weight: 800; color: #0f172a;">${node.name}</span>
            <span style="font-size: 9px; font-weight: 700; font-family: monospace; background: #e0e7ff; color: #4338ca; padding: 2px 6px; border-radius: 9999px;">
              ${node.status}
            </span>
          </div>
          <div style="font-size: 11px; color: #475569; font-weight: 600; margin-bottom: 4px;">
            Role: ${node.role}
          </div>
          <p style="font-size: 11px; color: #1e293b; line-height: 1.4; background: #f8fafc; padding: 6px; border-radius: 6px; border: 1px solid #f1f5f9; margin: 0;">
            "${node.recommendation}"
          </p>
        </div>
      `;

      const marker = new maplibregl.Marker({ element, anchor: "center" })
        .setLngLat([node.lng, node.lat])
        .setPopup(new maplibregl.Popup({ offset: 22 }).setHTML(popupHtml))
        .addTo(map);

      agentMarkersRef.current.push(marker);
    });
  };

  const addSwarmNetworkLines = (nodes) => {
    const map = mapRef.current;
    if (!map) return;

    if (map.getLayer("swarm-network-line")) map.removeLayer("swarm-network-line");
    if (map.getSource("swarm-network")) map.removeSource("swarm-network");

    const coordNode = nodes.find(n => n.id === "CoordinatorAgent");
    if (!coordNode) return;

    const features = nodes
      .filter(n => n.id !== "CoordinatorAgent")
      .map(node => ({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [
            [coordNode.lng, coordNode.lat],
            [node.lng, node.lat]
          ]
        }
      }));

    map.addSource("swarm-network", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features
      }
    });

    map.addLayer({
      id: "swarm-network-line",
      type: "line",
      source: "swarm-network",
      paint: {
        "line-color": "#8b5cf6",
        "line-width": 2,
        "line-dasharray": [2, 3],
        "line-opacity": 0.75
      }
    });
  };


  // =========================================================
  // FIT ROUTE
  // =========================================================

  const fitToRoute =
    (
      routeCoords
    ) => {

      const map =
        mapRef.current;


      if (

        !map

        ||

        !routeCoords.length

      ) {

        return;

      }


      const bounds =
        new maplibregl.LngLatBounds();


      routeCoords.forEach(

        coord => {

          bounds.extend(
            coord
          );

        }

      );


      map.fitBounds(

        bounds,

        {

          padding:
            90,

          maxZoom:
            14,

          duration:
            1200

        }

      );

    };


  // =========================================================
  // EMERGENCY VEHICLE ANIMATION
  // =========================================================

  const animateEmergencyVehicle =
    (
      routeCoords
    ) => {

      const map =
        mapRef.current;


      if (

        !map

        ||

        !routeCoords.length

      ) {

        return;

      }


      if (
        ambulanceRef.current
      ) {

        ambulanceRef.current.remove();

      }


      if (
        animationRef.current
      ) {

        clearInterval(
          animationRef.current
        );

      }


      const vehicle =
        document.createElement(
          "div"
        );


      const trafficData =

        data?.agents
          ?.TrafficAgent

        ||

        data?.traffic_response

        ||

        {};


      const vehicleType =
        trafficData?.vehicle_type

        ||

        trafficData?.traffic_response?.vehicle_type

        ||

        "ambulance";

      const normalizedVehicleType = String(
        vehicleType
      ).toLowerCase();


      let vehicleIcon =
        "🚑";


      if (

        normalizedVehicleType.includes(
          "fire"
        )

      ) {

        vehicleIcon =
          "🚒";

      }

      else if (

        normalizedVehicleType.includes(
          "evacuation"
        )

      ) {

        vehicleIcon =
          "🚌";

      }

      else if (

        normalizedVehicleType.includes(
          "rescue"
        )

      ) {

        vehicleIcon =
          "🚑";

      }


      vehicle.innerHTML =
        vehicleIcon;


      vehicle.style.fontSize =
        "34px";


      vehicle.style.filter =
        "drop-shadow(0 0 12px rgba(239,68,68,1))";


      ambulanceRef.current =
        new maplibregl.Marker({

          element:
            vehicle,

          anchor:
            "center"

        })

          .setLngLat(
            routeCoords[0]
          )

          .addTo(
            map
          );

      vehicleMarkersRef.current = [
        ambulanceRef.current,
      ];

      const resources =
        data?.resources ||
        data?.agents?.ResourceAgent?.decision?.resources ||
        {};

      const supportCount = normalizedVehicleType.includes("fire")
        ? Math.min(Math.max(Number(resources.fire_units || 1) - 1, 0), 3)
        : normalizedVehicleType.includes("flood")
          ? Math.min(Math.max(Number(resources.rescue_teams || 1) - 1, 0), 2)
          : 0;

      for (let vehicleIndex = 0; vehicleIndex < supportCount; vehicleIndex += 1) {
        const supportVehicle = document.createElement("div");
        supportVehicle.innerHTML = normalizedVehicleType.includes("fire") ? "🚒" : "🚤";
        supportVehicle.style.fontSize = "28px";
        supportVehicle.style.filter = "drop-shadow(0 0 9px rgba(239,68,68,0.85))";

        const supportMarker = new maplibregl.Marker({
          element: supportVehicle,
          anchor: "center",
        })
          .setLngLat(routeCoords[0])
          .addTo(map);

        vehicleMarkersRef.current.push(supportMarker);
      }


      let index =
        0;


      animationRef.current =
        setInterval(
          () => {

            if (

              index >=
              routeCoords.length

            ) {

              clearInterval(
                animationRef.current
              );


              animationRef.current =
                null;


              setRouteInfo(
                previous => ({

                  ...previous,

                  status:
                    "Emergency Unit Reached Disaster Zone"

                })
              );


              return;

            }


            vehicleMarkersRef.current.forEach(
              (marker, vehicleIndex) => {
                marker.setLngLat(
                  routeCoords[
                    Math.min(
                      index + vehicleIndex,
                      routeCoords.length - 1
                    )
                  ]
                );
              }
            );


            index += 1;

          },

          60
        );

    };


  // =========================================================
  // UI
  // =========================================================

  return (

    <div className="

      relative

      bg-slate-900

      rounded-2xl

      overflow-hidden

      shadow-xl

      border

      border-slate-800

      h-[550px]

    ">


      {/* HEADER */}

      <div className="absolute top-0 left-0 right-0 z-20 p-4 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-xs">
        <div className="flex justify-between items-center gap-3">

          {/* Title */}
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold text-gray-900 leading-tight">
              🌍 Intelligent Disaster Response Map
            </h2>
            <p className="text-xs text-gray-500 mt-0.5 font-medium truncate">
              {data?.scenario?.name ||
                data?.event?.disaster ||
                data?.event?.disaster_type ||
                "Active Emergency"}
              {" • "}
              {data?.scenario?.location ||
                data?.event?.location ||
                "Monitoring location"}
            </p>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Facility & Agent filters */}
            <div className="flex gap-1 rounded-xl border border-gray-200 bg-white/95 p-1 shadow-sm backdrop-blur-xs flex-wrap">
              {[
                ["all", "All"],
                ["coordinator", "🎯 Coordinator"],
                ["medical", "🩺 Medical"],
                ["resource", "📦 Resource"],
                ["fire_station", "🚒 Fire"],
                ["shelter", "🏠 Shelters"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFacilityFilter(value)}
                  className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition ${
                    facilityFilter === value
                      ? "bg-blue-600 text-white shadow-2xs"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Live badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200">
              <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
              <span className="text-xs font-bold text-red-700">LIVE</span>
            </div>
          </div>

        </div>

        {/* Legend row */}
        <div className="flex items-center gap-3 mt-2 text-[10px] font-bold uppercase tracking-wide text-gray-600 flex-wrap">
          <span><b className="mr-1 text-purple-600">🎯</b>Coordinator HQ</span>
          <span><b className="mr-1 text-teal-600">🩺</b>Medical Agent</span>
          <span><b className="mr-1 text-amber-600">📦</b>Resource Agent</span>
          <span><b className="mr-1 text-red-600">🚨</b>Emergency Ops</span>
          <span><b className="mr-1 text-blue-600">🚦</b>Traffic Control</span>
        </div>
      </div>



      {/* MAP */}

      <div

        ref={
          mapContainer
        }

        className="

          w-full

          h-full

        "

      />

    </div>

  );

}