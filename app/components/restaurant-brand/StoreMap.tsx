"use client";
import {useEffect} from "react";
import {MapContainer,TileLayer,CircleMarker,Popup,useMap} from "react-leaflet";
import {latLngBounds} from "leaflet";
import "leaflet/dist/leaflet.css";
import {coordinates,orderLink,type BrandStore} from "@/lib/restaurant-brand/brand";
function Fit({points}:{points:[number,number][]}){const map=useMap();const key=JSON.stringify(points);useEffect(()=>{if(points.length)map.fitBounds(latLngBounds(points),{padding:[35,35],maxZoom:13});},[map,key]);return null;}
export default function StoreMap({stores,brand,service}:{stores:BrandStore[];brand:string;service:string}){
 const located=stores.flatMap(store=>{const point=coordinates(store);return point?[{store,point}]:[];});
 if(!located.length)return <div className="flex h-full items-center justify-center bg-slate-100 p-8 text-sm text-slate-600">매장 지도 위치가 아직 등록되지 않았습니다. 목록에서 매장을 선택하세요.</div>;
 return <MapContainer center={located[0].point} zoom={10} className="h-full w-full" scrollWheelZoom={false}><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/><Fit points={located.map(item=>item.point)}/>{located.map(({store,point})=><CircleMarker key={store.id} center={point} radius={10} pathOptions={{color:"#ffffff",fillColor:"#b64032",fillOpacity:1,weight:3}}><Popup><strong>{store.name}</strong><p>{store.address}</p><a href={orderLink(brand,store.id,service)}>Order Here →</a></Popup></CircleMarker>)}</MapContainer>;
}
