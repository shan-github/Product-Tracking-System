import React, { Component } from 'react'
import {
  Text,
  View,
  Image,
  ActivityIndicator,
  Dimensions,
  Alert,
  PermissionsAndroid,
  Switch,
  TouchableHighlight,
  ScrollView,
  FlatList,
  Linking,
  Animated
} from 'react-native'
import { BleManager, Device } from 'react-native-ble-plx'
import { Buffer } from 'buffer'
import { db } from './src/db'
import Icon, { Button } from 'react-native-vector-icons/MaterialCommunityIcons'
import rnfs, { stat } from 'react-native-fs'
const SCREEN_HEIGHT = Dimensions.get('window').height
const SCREEN_WIDTH = Dimensions.get('window').width

const MAX_RSSI = 70
const serviceUUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b'
const codeUUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8'
const DEVICE_NAME = 'ESP32'

let dev = null
const ealert = (info, content) => {
  Alert.alert(
    info,
    content,
    [
      {
        text: 'Cancel',
        onPress: () => console.log('Cancel Pressed'),
        style: 'cancel'
      },
      { text: 'OK', onPress: () => console.log('OK Pressed') }
    ],
    { cancelable: true }
  )
}

const permission = () => {
  try {
    PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
    ).then(b => {
      if (!b) {
        PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
        ]).then(r => console.log(r))
      }
    })
  } catch (error) {
    ealert(error, '')
  }
}
let num = 0
export default class App extends Component {
  constructor(props) {
    super(props)
    permission()
    console.disableYellowBox = true
    this.manager = new BleManager()
    this.state = {
      code: null,
      connected: 'Not connected',
      device: Device,
      col: 'red',
      data: null,
      loading: false,
      rssi: 0,
      ble: 'off',
      distance: 0,
      devMode: false,
      status: false
    }
    this.data = []
    this.opac = new Animated.Value(0)
    this.getDetails()
  }

  postData(data) {
    console.info(
      'Creating file...' +
        rnfs.DocumentDirectoryPath +
        `/readings${Math.random() * 100}.json`
    )
    rnfs
      .writeFile(
        rnfs.ExternalStorageDirectoryPath + '/readings.json',
        JSON.stringify(data)
      )
      .then(res => {
        console.info(res)
        ealert('File created successfully')
      })
      .catch(err => Alert.alert(err))
  }

  readRSSI(device) {
    setTimeout(() => {
      device
        .readRSSI()
        .then(dev => {
          num = Math.round(Math.pow(10, (-69 - dev.rssi) / 20) * 100) / 100
          this.setState({ rssi: dev.rssi, distance: num })
          let obj = { rssi: dev.rssi, distance: num }
          // this.data.push(obj);
          // console.log(this.data);
        })
        .catch(error => {})
    }, 500)
  }
  getDetails(prop) {
    console.log(prop)
    let ref = db.ref('/' + prop)
    ref.on('value', snapshot => {
      let data = snapshot.val()
      console.log(data)
      this.setState({ data: data, loading: false }, () => {
        Animated.timing(this.opac, { duration: 1000, toValue: 1 }).start()
      })
    })
  }
  componentWillUpdate() {
    let { device } = this.state
    if (device.id != null) {
      if (
        this.manager.isDeviceConnected(device.id).then(bool => bool) &&
        this.state.rssi <= -MAX_RSSI
      ) {
        this.manager
          .cancelDeviceConnection(this.state.device.id)
          .then(dev => {
            //console.log(dev);
            console.log('---------disconnect-------', dev.name, ' disconnected')
            this.setState({
              col: '#ef6c00',
              connected: 'Discovering...',
              device: Device,
              data: null,
              rssi: 0
            })
            this.scanAndConnect()
          })
          .catch(err => console.log(err))
      }
    }
    if (typeof this.state.device !== typeof Device)
      this.readRSSI(this.state.device)
  }
  componentDidMount() {
    this.setState({ loading: true })
    const subscription = this.manager.onStateChange(state => {
      if (state === 'PoweredOn') {
        this.setState({ ble: 'on', status: true })
        this.scanAndConnect()
      }
      if (state === 'PoweredOff') {
        this.setState({
          ble: 'off',
          device: Device,
          connected: 'Not Connected',
          col: 'red',
          // data: null,
          rssi: 0,
          status: false
        })
        // if (this.state.distance !== 0) this.postData(this.data);
      }
    }, true)
  }

  scanAndConnect() {
    const ids = []
    this.manager.startDeviceScan(null, null, (error, device) => {
      console.log(device)
      if (device) {
        ids.push(device.id)
        this.setState({ ids: [...new Set(ids)] })
      }
      if (device === null ? false : device.name === DEVICE_NAME)
        this.setState({ device: device, rssi: device.rssi })
      if (error) {
        console.log(error)
        return
      }

      if (device.name === DEVICE_NAME /*&& device.rssi>=-60*/) {
        this.manager.stopDeviceScan()
        this.setState({
          connected: 'Connected',
          device: device,
          col: 'green',
          loading: true
        })
        device
          .connect()
          .then(devices => {
            this.readRSSI(devices)
            return devices.discoverAllServicesAndCharacteristics()
          })
          .then(d => {
            return d.readCharacteristicForService(serviceUUID, codeUUID)
          })
          .then(char => {
            const val = Buffer.from(char.value, 'base64').toString('ascii')
            this.setState({ code: val })
            this.getDetails(val)
          })
          .catch(error => Alert.alert('catch' + error))
      }
    })
  }
  renderIcon(name) {
    return <Icon name={name} size={15} />
  }
  render() {
    const { devMode, ids, ble, status, data, rssi } = this.state
    return (
      <View style={{ flex: 1 }}>
        <View style={styles.header}>
          <View style={styles.floatH}>
            <Icon
              name='cube'
              size={25}
              style={{ marginRight: 10 }}
              color='#2196f3'
            />
            <Text style={{ fontSize: 20 }}>BTracker</Text>
          </View>
          <View style={styles.floatH}>
            <View style={[styles.floatH, { fontSize: 10 }]}>
              <Text>Dev Mode</Text>
              <Switch
                thumbColor={devMode ? '#2196f3' : '#fff'}
                value={devMode}
                onValueChange={val => this.setState({ devMode: !devMode })}
              />
            </View>
            <Icon name='dots-vertical' size={22} />
          </View>
        </View>
        {devMode ? (
          <View
            style={{
              alignItems: 'center',
              padding: 10,
              position: 'absolute',
              top: 60,
              right: 10,
              backgroundColor: '#fff',
              elevation: 5,
              borderRadius: 5
            }}>
            <Text
              style={{
                color: this.state.col,
                fontSize: 10,
                // backgroundColor: this.state.col,
                // paddingVertical: 6,
                paddingHorizontal: 15,
                borderRadius: 20,
                fontWeight: 'bold'
              }}>
              {ble == 'off' ? 'Bluetooth is off' : this.state.connected}
            </Text>
            {ids ? (
              ids.map(d => (
                <Text key={d} style={styles.chip}>
                  {d}
                </Text>
              ))
            ) : (
              <View />
            )}
            <Text>{this.state.device == null ? '' : this.state.device.id}</Text>
            <Text style={{ color: 'black', fontSize: 12 }}>
              {this.state.device == null ? '' : this.state.device.name}
            </Text>
            <Text style={{ color: 'blue', fontSize: 12 }}>
              RSSI: {this.state.rssi}
            </Text>
            <Text style={{ color: '#004d40', fontSize: 12 }}>
              Distance: {this.state.distance}
            </Text>
          </View>
        ) : (
          <View></View>
        )}
        <ActivityIndicator
          color='#2196f3'
          size={40}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0
          }}
          animating={this.state.loading}
        />
        <ScrollView>
          <View
            style={
              {
                // borderRadius: 5
              }
            }>
            {/* <Text style={{ fontSize: 40, padding: 10, textAlign: "center" }}>
            {this.state.rssi == 0
              ? ""
              : this.state.rssi <= -75
              ? "You are Coming towards " + this.state.data.name
              : this.state.rssi >= -70
              ? "Welcome to " + this.state.data.name
              : "Just few more steps..."}
          </Text> */}
            <Image
              source={
                data
                  ? { uri: data.image }
                  : require('./src/nu.jpg')
              }
              style={{ width: '100%', height: SCREEN_HEIGHT / 4 }}
              resizeMode='center'
            />
            { data ? (
              <Animated.View style={{ padding: 20, opacity: this.opac }}>
                <View
                  style={{
                    marginBottom: 10,
                    flexDirection: 'row',
                    alignSelf: 'center'
                  }}>
                  <Icon
                    name='cube-outline'
                    color='#000'
                    size={30}
                    style={{ paddingRight: 10 }}
                  />
                  <Text
                    style={{ fontSize: 30, fontWeight: 'bold', color: '#000' }}>
                    {data.name}
                  </Text>
                </View>
                <View style={styles.box}>
                  <Text style={styles.head}>
                    <Icon
                      name='lightbulb-outline'
                      color='#2196f3'
                      size={20}
                      style={styles.icon}
                    />
                    Description
                  </Text>
                  <Text style={styles.content}>{data.description}</Text>
                </View>
                {data.images ? (
                  <React.Fragment>
                    <View style={[styles.head, { marginTop: 20 }]}>
                      <Icon
                        name='image-outline'
                        color='#2196f3'
                        size={20}
                        style={styles.icon}
                      />
                      <Text style={{ fontSize: 20, color: '#2196f3' }}>
                        More Images
                      </Text>
                    </View>
                    <FlatList
                      style={{ paddingVertical: 10 }}
                      data={data.images}
                      horizontal
                      scrollEnabled
                      renderItem={({ item }) => (
                        <Image
                          style={{
                            width: SCREEN_WIDTH / 3,
                            height: SCREEN_WIDTH / 3,
                            borderColor: '#2196f3',
                            borderRadius: 5,
                            elevation: 2,
                            borderWidth: 1,
                            marginRight: 10
                          }}
                          source={{ uri: item }}
                        />
                      )}
                    />
                  </React.Fragment>
                ) : null}
                <Text style={{ fontSize: 20, marginTop: 50 }}>
                  {data.extra}
                </Text>
              </Animated.View>
            ) : null}

            {/* <View
            style={{
              position: "absolute",
              bottom: 0,
              display: "flex",
              flexDirection: "row",
              padding: 10,
              borderTopColor: "#bdbdbd",
              backgroundColor: "#e0e0e0",
              borderRadius: 5
            }}
          >
            {this.state.loading ? null : this.renderIcon("caretleft")}
            <Text style={{ fontSize: 15, flex: 3 }}>
              {this.state.data.left == ""
                ? ""
                : "Walk left to " + this.state.data.left}
            </Text>
            <Text style={{ fontSize: 15 }}>
              {this.state.data.left == ""
                ? ""
                : "Walk right to " + this.state.data.right}
            </Text>
            {this.state.loading ? null : this.renderIcon("caretright")}
          </View> */}
            {data ? (
              <TouchableHighlight
                underlayColor='#2196f355'
                onPress={() => {
                  Linking.canOpenURL(data.link).then(res => {
                    if (res) Linking.openURL(data.link)
                  })
                }}
                style={styles.more}>
                <React.Fragment>
                  <Text
                    style={{ color: '#fff', marginRight: 10, fontSize: 15 }}>
                    More Info
                  </Text>
                  <Icon name='lightbulb' color='#fff' size={20} />
                </React.Fragment>
              </TouchableHighlight>
            ) : null}
          </View>
        </ScrollView>

        <TouchableHighlight
          underlayColor='#2196f355'
          style={[styles.ble, { backgroundColor: status ? '#2196f3' : '#fff' }]}
          onPress={() => {
            if (status) this.manager.disable().then(() => console.log('B_OFF'))
            else this.manager.enable().then(() => console.log('B_ON'))
            this.setState({ status: !status })
          }}>
          <React.Fragment>
            <Icon
              name={`bluetooth-${status ? 'off' : 'connect'}`}
              color={status ? '#fff' : '#2196f3'}
              size={20}
            />
            <Text
              style={{
                color: status ? '#fff' : '#2196f3',
                marginRight: 10,
                fontSize: 15
              }}>
              Turn {status ? 'OFF' : 'ON'} bluetooth
            </Text>
          </React.Fragment>
        </TouchableHighlight>
      </View>
    )
  }
}
const styles = {
  header: {
    padding: 15,
    elevation: 2,
    backgroundColor: '#fff',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  floatH: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center'
  },
  icon: {
    marginRight: 15
  },
  content: {
    fontSize: 20,
    color: '#000'
  },
  more: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#2196f3',
    borderRadius: 40,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 3
  },
  chip: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eee',
    paddingHorizontal: 10,
    margin: 2
  },
  ble: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    padding: 10,
    backgroundColor: '#fff',
    borderColor: '#2196f3',
    // borderWidth: 1,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 10
  },
  box: {
    padding: 15,
    borderColor: '#2196f3',
    borderWidth: 1,
    marginVertical: 10,
    borderRadius: 10,
    fontSize: 20
  },
  head: {
    fontSize: 20,
    color: '#2196f3',
    paddingBottom: 10,
    flexDirection: 'row'
  }
}
