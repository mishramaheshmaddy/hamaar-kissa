import React, { useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";

export default function EditProfileScreen() {
  const router = useRouter();
  const colors = useColors();
  const { user, token, fetchUser } = useAuth();

const DOMAIN = process.env.EXPO_PUBLIC_DOMAIN;
const BASE = DOMAIN ? `https://${DOMAIN}` : "";

const [saving,setSaving]=useState(false);
const [usernameAvailable,setUsernameAvailable]=useState<boolean|null>(null);
const [usernameError,setUsernameError]=useState("");

  const [fullName,setFullName]=useState("");
  const [username,setUsername]=useState("");
  const [dob,setDob]=useState("");
  const [age,setAge]=useState("");
  const [mobile,setMobile]=useState("");
  const [email,setEmail]=useState("");
const [avatar,setAvatar]=useState(user?.avatarUrl ?? "");

  useEffect(()=>{
    if(!user) return;

    setFullName(user.name ?? "");
    setMobile(user.phone ?? "");
    setEmail(user.email ?? "");
setAvatar(user.avatarUrl ?? "");

    const generated=(user.name ?? "user")
      .toLowerCase()
      .replace(/[^a-z0-9]/g,"");

    setUsername(generated);

  },[user]);



  async function pickAvatar(){

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if(!perm.granted){
      Alert.alert("Permission","Gallery permission required.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality:0.8,
    });

    if(result.canceled) return;

    const asset=result.assets[0];

    setAvatar(asset.uri);

    try{

      const response=await fetch(asset.uri);
      const blob=await response.blob();

      const file=new File(
        [blob],
        asset.fileName ?? "avatar.jpg",
        {type:blob.type || "image/jpeg"}
      );

      const formData=new FormData();
      formData.append("file",file);

      const res=await fetch(`${BASE}/api/media/upload`,{
        method:"POST",
        body:formData,
      });

      const data=await res.json();

      if(!data.url){
        Alert.alert("Error","Upload failed");
        return;
      }

      setAvatar(
        data.url.startsWith("/")
          ? `${BASE}${data.url}`
          : data.url
      );

    }catch{
      Alert.alert("Error","Image upload failed.");
    }

  }


  async function saveProfile(){

    if(!token){
      Alert.alert("Error","Login required");
      return;
    }

    try{

      setSaving(true);

      const res=await fetch(`${BASE}/api/auth/profile`,{
        method:"PUT",
        headers:{
          "Content-Type":"application/json",
          Authorization:`Bearer ${token}`,
        },
        body:JSON.stringify({
          name:fullName.trim(),
          username:username.trim()||null,
          dateOfBirth:dob||null,
          age:age?Number(age):null,
          phone:mobile||null,
          email:email||null,
          avatarUrl:avatar,
        }),
      });

      const data=await res.json();

      if(!res.ok){
        Alert.alert("Error",data.error||"Save failed");
        return;
      }

      await fetchUser();

      Alert.alert(
        "Success",
        "प्रोफाइल अपडेट हो गइल।",
        [{text:"OK",onPress:()=>router.back()}]
      );

    }catch(e){
      Alert.alert("Error","कुछ गलती हो गइल।");
    }finally{
      setSaving(false);
    }

  }



  
useEffect(()=>{

  if(!username){

    setUsernameAvailable(null);
    setUsernameError("");
    return;

  }

  if(username.length<3){

    setUsernameAvailable(null);
    setUsernameError("कम से कम 3 अक्षर जरूरी बा");
    return;

  }

  if(username.length>20){

    setUsernameAvailable(null);
    setUsernameError("20 अक्षर से अधिक ना हो सके");
    return;

  }

  setUsernameError("");

  const timer=setTimeout(async()=>{

    try{

      const res=await fetch(
        `${BASE}/api/auth/check-username?username=${encodeURIComponent(username)}`
      );

      const data=await res.json();

      setUsernameAvailable(data.available);

    }catch{}

  },400);

  return ()=>clearTimeout(timer);

},[username]);




  useEffect(()=>{

    const parts=dob.split("/").map(v=>v.trim());

    if(parts.length!==3) return;

    const day=Number(parts[0]);
    const month=Number(parts[1]);
    const year=Number(parts[2]);

    if(!day || !month || !year) return;

    const birth=new Date(year,month-1,day);

    if(isNaN(birth.getTime())) return;

    const today=new Date();

    let years=today.getFullYear()-birth.getFullYear();

    const m=today.getMonth()-birth.getMonth();

    if(m<0 || (m===0 && today.getDate()<birth.getDate())){
      years--;
    }

    if(years>=0){
      setAge(String(years));
    }

  },[dob]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
    >
      <TouchableOpacity onPress={() => router.back()}>
        <Feather name="arrow-left" size={24} color={colors.foreground} />
      </TouchableOpacity>

      <Text style={[styles.title,{color:colors.foreground}]}>
        प्रोफाइल एडिट करी
      </Text>

      <TouchableOpacity
        style={styles.avatarHolder}
        onPress={pickAvatar}
      >
        <View style={styles.avatar}>
          {avatar ? (
            <Image
              source={{uri:avatar}}
              style={{width:120,height:120,borderRadius:60}}
              contentFit="cover"
            />
          ) : (
            <Feather name="user" size={46} color="#ffffff" />
          )}
        </View>

        <View style={styles.editBadge}>
          <Feather name="edit-2" size={14} color="#fff" />
        </View>

        <Text style={[styles.changePhoto,{color:colors.primary}]}>
          फोटो बदलीं
        </Text>
      </TouchableOpacity>

      <Text style={styles.label}>राउर पूरा नाम</Text>
      <TextInput style={styles.input} value={fullName} onChangeText={setFullName} />

      <Text style={styles.label}>Username</Text>
      <>
<TextInput
style={styles.input}
value={username}
onChangeText={(value)=>{
const clean=value
.toLowerCase()
.replace(/\s+/g,"")
.replace(/[^a-z0-9_]/g,"")
.slice(0,20);

setUsername(clean);
}}
/>


{!!usernameError && (
<Text
style={{
marginTop:6,
fontWeight:"600",
color:"#d32f2f"
}}>
{usernameError}
</Text>
)}

{!usernameError && usernameAvailable!==null && (

<Text
style={{
marginTop:6,
fontWeight:"600",
color:usernameAvailable ? "green" : "#d32f2f"
}}>
{usernameAvailable
?"✓ Username available"
:"✗ Username पहले से इस्तेमाल हो रहल बा"}
</Text>

)}


</>

      <Text style={styles.label}>जन्म तिथि</Text>
      <TextInput
        style={styles.input}
        placeholder="DD / MM / YYYY"
        value={dob}
        onChangeText={setDob}
      />

      <Text style={styles.label}>उमिर</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={age}
        onChangeText={setAge}
      />

      <Text style={styles.label}>मोबाइल</Text>
      <TextInput
        style={styles.input}
        value={mobile}
        onChangeText={setMobile}
        editable={user?.authProvider!=="phone"}
      />

      <Text style={styles.label}>ईमेल</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        editable={user?.authProvider==="phone"}
      />

      <TouchableOpacity style={styles.saveBtn} disabled={saving} onPress={saveProfile}>
        {saving
? <ActivityIndicator color="#fff"/>
: <Text style={styles.saveText}>सेव करी</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
container:{
padding:20,
paddingBottom:80,
},

title:{
fontSize:28,
fontWeight:"800",
marginTop:20,
marginBottom:30,
},

avatarHolder:{
alignItems:"center",
marginBottom:30,
},

avatar:{
width:120,
height:120,
borderRadius:60,
backgroundColor:"#F05A28",
justifyContent:"center",
alignItems:"center",
},

editBadge:{
position:"absolute",
right:110,
top:80,
backgroundColor:"#F05A28",
width:34,
height:34,
borderRadius:17,
justifyContent:"center",
alignItems:"center",
borderWidth:2,
borderColor:"#fff",
},

changePhoto:{
marginTop:12,
fontWeight:"700",
},

label:{
marginTop:16,
marginBottom:6,
fontWeight:"700",
},

input:{
borderWidth:1,
borderColor:"#ddd",
borderRadius:12,
paddingHorizontal:14,
height:52,
},

saveBtn:{
marginTop:30,
height:54,
borderRadius:14,
backgroundColor:"#F05A28",
justifyContent:"center",
alignItems:"center",
},

saveText:{
color:"#fff",
fontSize:17,
fontWeight:"700",
},
});
